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

    public TravelPlaceService(TravelPlaceRepository repository) {
        this.repository = repository;
    }

    public List<TravelPlaceDto> getPlacesByUser(String userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(TravelPlaceDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public TravelPlaceDto save(TravelPlaceSaveRequest req, String userId) {
        TravelPlace place = new TravelPlace();
        place.setUserId(userId);
        place.setCategory(req.category());
        place.setPlaceName(req.placeName());
        place.setAddress(req.address());
        place.setReview(req.review());
        place.setLatitude(req.latitude());
        place.setLongitude(req.longitude());
        return TravelPlaceDto.from(repository.save(place));
    }

    @Transactional
    public TravelPlaceDto update(Long id, TravelPlaceSaveRequest req, String userId) {
        TravelPlace place = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Travel place not found."));
        place.setCategory(req.category());
        place.setPlaceName(req.placeName());
        place.setAddress(req.address());
        place.setReview(req.review());
        place.setLatitude(req.latitude());
        place.setLongitude(req.longitude());
        return TravelPlaceDto.from(repository.save(place));
    }

    @Transactional
    public void delete(Long id, String userId) {
        TravelPlace place = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Travel place not found."));
        repository.delete(place);
    }
}
