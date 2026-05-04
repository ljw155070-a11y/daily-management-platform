package com.home.platform.travel;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class TravelPlaceService {

    private final TravelPlaceRepository repository;
    private final TravelPlaceImageStorageService imageStorageService;

    public TravelPlaceService(TravelPlaceRepository repository, TravelPlaceImageStorageService imageStorageService) {
        this.repository = repository;
        this.imageStorageService = imageStorageService;
    }

    public List<TravelPlaceDto> getPlacesByUser(String userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(TravelPlaceDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public TravelPlaceDto save(TravelPlaceFormRequest req, String userId) {
        TravelPlace place = new TravelPlace();
        place.setUserId(userId);
        place.setCategory(req.getCategory());
        place.setPlaceName(req.getPlaceName());
        place.setAddress(req.getAddress());
        place.setReview(req.getReview());
        place.setLatitude(req.getLatitude());
        place.setLongitude(req.getLongitude());
        place.setImageUrl(imageStorageService.store(req.getImageFile()));
        return TravelPlaceDto.from(repository.save(place));
    }

    @Transactional
    public TravelPlaceDto update(Long id, TravelPlaceFormRequest req, String userId) {
        TravelPlace place = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Travel place not found."));
        place.setCategory(req.getCategory());
        place.setPlaceName(req.getPlaceName());
        place.setAddress(req.getAddress());
        place.setReview(req.getReview());
        place.setLatitude(req.getLatitude());
        place.setLongitude(req.getLongitude());
        if (req.getImageFile() != null && !req.getImageFile().isEmpty()) {
            imageStorageService.deleteIfPresent(place.getImageUrl());
            place.setImageUrl(imageStorageService.store(req.getImageFile()));
        }
        return TravelPlaceDto.from(repository.save(place));
    }

    @Transactional
    public void delete(Long id, String userId) {
        TravelPlace place = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Travel place not found."));
        imageStorageService.deleteIfPresent(place.getImageUrl());
        repository.delete(place);
    }
}
