package com.home.platform.travel;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class PublicTravelAttractionService {

    private static final Logger log = LoggerFactory.getLogger(PublicTravelAttractionService.class);
    private static final Duration AREA_CACHE_TTL = Duration.ofHours(1);
    private static final List<String> ALL_AREA_CODES = List.of(
            "1", "2", "3", "4", "5", "6", "7", "8",
            "31", "32", "33", "34", "35", "36", "37", "38", "39");
    private final PublicTravelAttractionRepository repository;
    private final PublicTravelCoordinateHistoryRepository coordinateHistoryRepository;
    private final TourApiService tourApiService;

    // Set to true once at startup (or after sync) so we never run COUNT(*) per request again
    private final AtomicBoolean seeded = new AtomicBoolean(false);

    // Per-areaCode in-memory cache — avoids repeated DB queries for the same province
    private final Map<String, List<TourApiAttractionDto>> areaCache = new ConcurrentHashMap<>();
    private volatile Instant areaCacheExpiry = Instant.MIN;

    public PublicTravelAttractionService(PublicTravelAttractionRepository repository,
                                         PublicTravelCoordinateHistoryRepository coordinateHistoryRepository,
                                         TourApiService tourApiService) {
        this.repository = repository;
        this.coordinateHistoryRepository = coordinateHistoryRepository;
        this.tourApiService = tourApiService;
    }

    @PostConstruct
    public void init() {
        if (repository.countByActiveFlag("Y") > 0) {
            reapplyCoordinateHistory();
            seeded.set(true);
            // Pre-warm all 17 area caches in background — after this every region click is instant
            Thread prewarmer = new Thread(this::prewarmAllAreaCaches, "attraction-cache-prewarmer");
            prewarmer.setDaemon(true);
            prewarmer.start();
        }
    }

    private void prewarmAllAreaCaches() {
        log.info("Pre-warming attraction cache for {} areas...", ALL_AREA_CODES.size());
        for (String areaCode : ALL_AREA_CODES) {
            try {
                getFromCacheOrDb(areaCode);
            } catch (Exception e) {
                log.warn("Cache prewarm failed for area {}: {}", areaCode, e.getMessage());
            }
        }
        log.info("Attraction cache pre-warm complete.");
    }

    public boolean isAvailable() {
        return seeded.get() || tourApiService.isEnabled();
    }

    public List<TourApiAttractionDto> getAllAttractions() {
        ensureSeededIfNeeded();
        return repository.findByActiveFlagOrderByTitleAsc("Y")
                .stream()
                .map(this::toDto)
                .toList();
    }

    public List<TourApiAttractionDto> getAttractionsByProvince(String provinceName) {
        ensureSeededIfNeeded();
        String areaCode = TourApiService.getAreaCodeForProvince(normalizeProvinceName(provinceName));
        if (areaCode == null) {
            return List.of();
        }
        return getFromCacheOrDb(areaCode);
    }

    public List<TourApiAttractionDto> getAttractionsByRegion(String regionName) {
        ensureSeededIfNeeded();

        String normalized = normalizeRegionName(regionName);
        if (normalized.isBlank()) {
            return List.of();
        }

        String areaCode = TourApiService.getAreaCodeForProvince(normalizeProvinceName(normalized));
        if (areaCode == null) {
            return List.of();
        }

        List<TourApiAttractionDto> provinceItems = getFromCacheOrDb(areaCode);

        if (!normalized.contains(" ")) {
            return provinceItems;
        }

        List<String> prefixes = getRegionAddressPrefixes(normalized);
        return provinceItems.stream()
                .filter(dto -> startsWithAny(dto.address(), prefixes))
                .toList();
    }

    @Transactional
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 0 4 ? * MON", zone = "Asia/Seoul")
    public void syncWeekly() {
        syncAllAttractions();
    }

    @Transactional
    public int syncAllAttractions() {
        if (!tourApiService.isEnabled()) {
            log.info("Skipping sync: TourAPI key not configured.");
            return 0;
        }

        try {
            List<TourApiAttractionDto> latest = tourApiService.getNationwideAttractions();
            Map<String, TourApiAttractionDto> latestByContentId = new LinkedHashMap<>();
            for (TourApiAttractionDto dto : latest) {
                if (dto.contentId() != null && !dto.contentId().isBlank()) {
                    latestByContentId.put(dto.contentId(), dto);
                }
            }

            List<PublicTravelAttraction> existing = repository.findAll();
            Map<String, PublicTravelAttraction> existingByContentId = new HashMap<>();
            for (PublicTravelAttraction attraction : existing) {
                existingByContentId.put(attraction.getExternalContentId(), attraction);
            }

            LocalDateTime syncedAt = LocalDateTime.now();
            Set<String> seenContentIds = new HashSet<>();
            List<PublicTravelAttraction> toSave = new ArrayList<>(latestByContentId.size());

            for (TourApiAttractionDto dto : latestByContentId.values()) {
                seenContentIds.add(dto.contentId());
                PublicTravelAttraction entity = existingByContentId.get(dto.contentId());
                if (entity == null) {
                    entity = new PublicTravelAttraction();
                    entity.setExternalContentId(dto.contentId());
                }
                applyDto(entity, dto, syncedAt);
                toSave.add(entity);
            }
            repository.saveAll(toSave);
            reapplyCoordinateHistory();

            List<PublicTravelAttraction> toDeactivate = new ArrayList<>();
            for (PublicTravelAttraction entity : existing) {
                if (!seenContentIds.contains(entity.getExternalContentId()) && entity.isActive()) {
                    entity.setActive(false);
                    entity.setLastSyncedAt(syncedAt);
                    toDeactivate.add(entity);
                }
            }
            if (!toDeactivate.isEmpty()) {
                repository.saveAll(toDeactivate);
            }

            areaCache.clear();
            areaCacheExpiry = Instant.MIN;
            seeded.set(true);

            // Re-warm cache after sync so next user click is still instant
            Thread rewarmer = new Thread(this::prewarmAllAreaCaches, "attraction-cache-rewarmer");
            rewarmer.setDaemon(true);
            rewarmer.start();

            log.info("Sync complete: {} active items.", latestByContentId.size());
            return latestByContentId.size();
        } catch (Exception e) {
            log.error("Failed to sync public travel attractions.", e);
            throw new IllegalStateException("Public travel attraction sync failed: " + rootCauseMessage(e), e);
        }
    }

    @Transactional(readOnly = true)
    public long countActiveAttractions() {
        return repository.countByActiveFlag("Y");
    }

    @Transactional
    public TourApiAttractionDto updateCoordinates(String contentId, Double latitude, Double longitude, String reason) {
        if (contentId == null || contentId.isBlank()) {
            throw new IllegalArgumentException("contentId is required.");
        }
        if (latitude == null || longitude == null) {
            throw new IllegalArgumentException("latitude and longitude are required.");
        }

        PublicTravelAttraction attraction = repository.findByExternalContentId(contentId)
                .orElseThrow(() -> new IllegalArgumentException("Attraction not found: " + contentId));

        attraction.setLatitude(latitude);
        attraction.setLongitude(longitude);
        repository.save(attraction);

        PublicTravelCoordinateHistory history = new PublicTravelCoordinateHistory();
        history.setExternalContentId(contentId);
        history.setLatitude(latitude);
        history.setLongitude(longitude);
        history.setReason(trimToLength(reason, 500));
        history.setActiveFlag("Y");
        history.setLastAppliedAt(LocalDateTime.now());
        coordinateHistoryRepository.save(history);

        areaCache.clear();
        areaCacheExpiry = Instant.MIN;

        return toDto(attraction);
    }

    private List<TourApiAttractionDto> getFromCacheOrDb(String areaCode) {
        if (Instant.now().isBefore(areaCacheExpiry)) {
            List<TourApiAttractionDto> cached = areaCache.get(areaCode);
            if (cached != null) {
                return cached;
            }
        }

        List<TourApiAttractionDto> result = repository.findByAreaCodeAndActiveFlagOrderByTitleAsc(areaCode, "Y")
                .stream()
                .map(this::toDto)
                .toList();

        areaCache.put(areaCode, result);
        if (!Instant.now().isBefore(areaCacheExpiry)) {
            areaCacheExpiry = Instant.now().plus(AREA_CACHE_TTL);
        }
        return result;
    }

    private void ensureSeededIfNeeded() {
        if (!seeded.get() && tourApiService.isEnabled()) {
            syncAllAttractions();
        }
    }

    private void applyDto(PublicTravelAttraction entity, TourApiAttractionDto dto, LocalDateTime syncedAt) {
        entity.setTitle(trimToLength(dto.title(), 300));
        entity.setAddress(trimToLength(dto.address(), 500));
        entity.setImageUrl(trimToLength(dto.imageUrl(), 1000));
        entity.setLatitude(dto.latitude());
        entity.setLongitude(dto.longitude());
        entity.setAreaCode(trimToLength(dto.areaCode(), 20));
        entity.setActive(true);
        entity.setLastSyncedAt(syncedAt);
    }

    private TourApiAttractionDto toDto(PublicTravelAttraction entity) {
        return new TourApiAttractionDto(
                entity.getExternalContentId(),
                entity.getTitle(),
                entity.getAddress() == null ? "" : entity.getAddress(),
                entity.getImageUrl(),
                entity.getLatitude(),
                entity.getLongitude(),
                entity.getAreaCode()
        );
    }

    private String normalizeProvinceName(String provinceName) {
        String normalized = provinceName == null ? "" : provinceName.trim();
        if (normalized.contains(" ")) {
            normalized = normalized.substring(0, normalized.indexOf(' '));
        }
        return TourApiService.normalizeProvinceName(normalized);
    }

    private String normalizeRegionName(String regionName) {
        return regionName == null ? "" : regionName.trim().replaceAll("\\s+", " ");
    }

    private boolean startsWithAny(String address, List<String> prefixes) {
        if (address == null || address.isBlank()) {
            return false;
        }
        for (String prefix : prefixes) {
            if (address.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private List<String> getRegionAddressPrefixes(String regionName) {
        if (!regionName.contains(" ")) {
            return getProvinceVariants(regionName);
        }

        String province = normalizeProvinceName(regionName);
        String remainder = regionName.substring(regionName.indexOf(' ') + 1).trim();
        LinkedHashSet<String> prefixes = new LinkedHashSet<>();
        for (String provinceVariant : getProvinceVariants(province)) {
            prefixes.add(provinceVariant + " " + remainder);
        }
        return List.copyOf(prefixes);
    }

    private List<String> getProvinceVariants(String province) {
        return switch (province) {
            case "서울특별시", "서울" -> List.of("서울특별시", "서울");
            case "부산광역시", "부산" -> List.of("부산광역시", "부산");
            case "대구광역시", "대구" -> List.of("대구광역시", "대구");
            case "인천광역시", "인천" -> List.of("인천광역시", "인천");
            case "광주광역시", "광주" -> List.of("광주광역시", "광주");
            case "대전광역시", "대전" -> List.of("대전광역시", "대전");
            case "울산광역시", "울산" -> List.of("울산광역시", "울산");
            case "세종특별자치시", "세종" -> List.of("세종특별자치시", "세종");
            case "경기도", "경기" -> List.of("경기도", "경기");
            case "강원특별자치도", "강원도", "강원" -> List.of("강원특별자치도", "강원도", "강원");
            case "충청북도", "충북" -> List.of("충청북도", "충북");
            case "충청남도", "충남" -> List.of("충청남도", "충남");
            case "전북특별자치도", "전라북도", "전북" -> List.of("전북특별자치도", "전라북도", "전북");
            case "전라남도", "전남" -> List.of("전라남도", "전남");
            case "경상북도", "경북" -> List.of("경상북도", "경북");
            case "경상남도", "경남" -> List.of("경상남도", "경남");
            case "제주특별자치도", "제주도", "제주" -> List.of("제주특별자치도", "제주도", "제주");
            default -> List.of(province);
        };
    }

    private String trimToLength(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String rootCauseMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        String message = current.getMessage();
        return (message == null || message.isBlank()) ? current.getClass().getSimpleName() : message;
    }

    private void reapplyCoordinateHistory() {
        List<PublicTravelCoordinateHistory> histories = coordinateHistoryRepository.findByActiveFlagOrderByUpdatedAtDesc("Y");
        if (histories.isEmpty()) {
            return;
        }

        Map<String, PublicTravelCoordinateHistory> latestByContentId = new LinkedHashMap<>();
        for (PublicTravelCoordinateHistory history : histories) {
            latestByContentId.putIfAbsent(history.getExternalContentId(), history);
        }

        List<PublicTravelAttraction> attractionsToUpdate = new ArrayList<>();
        List<PublicTravelCoordinateHistory> historiesToUpdate = new ArrayList<>();
        LocalDateTime appliedAt = LocalDateTime.now();

        for (PublicTravelCoordinateHistory history : latestByContentId.values()) {
            repository.findByExternalContentId(history.getExternalContentId()).ifPresent(attraction -> {
                boolean changed = !history.getLatitude().equals(attraction.getLatitude())
                        || !history.getLongitude().equals(attraction.getLongitude());
                if (changed) {
                    attraction.setLatitude(history.getLatitude());
                    attraction.setLongitude(history.getLongitude());
                    attractionsToUpdate.add(attraction);
                }
                history.setLastAppliedAt(appliedAt);
                historiesToUpdate.add(history);
            });
        }

        if (!attractionsToUpdate.isEmpty()) {
            repository.saveAll(attractionsToUpdate);
        }
        if (!historiesToUpdate.isEmpty()) {
            coordinateHistoryRepository.saveAll(historiesToUpdate);
        }
    }
}
