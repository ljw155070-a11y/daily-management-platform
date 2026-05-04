package com.home.platform.travel;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "TRAVEL_PLACE")
public class TravelPlace {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "travelPlaceSeq")
    @SequenceGenerator(name = "travelPlaceSeq", sequenceName = "TRAVEL_PLACE_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "USER_ID", nullable = false, length = 100)
    private String userId;

    @Column(name = "CATEGORY", nullable = false, length = 20)
    private String category;

    @Column(name = "PLACE_NAME", nullable = false, length = 200)
    private String placeName;

    @Column(name = "ADDRESS", nullable = false, length = 500)
    private String address;

    @Column(name = "REVIEW", length = 4000)
    private String review;

    @Column(name = "IMAGE_URL", length = 500)
    private String imageUrl;

    @Column(name = "LATITUDE")
    private Double latitude;

    @Column(name = "LONGITUDE")
    private Double longitude;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public TravelPlace() {}

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId()                   { return id; }
    public void setId(Long id)            { this.id = id; }

    public String getUserId()             { return userId; }
    public void setUserId(String userId)  { this.userId = userId; }

    public String getCategory()                   { return category; }
    public void setCategory(String category)      { this.category = category; }

    public String getPlaceName()                  { return placeName; }
    public void setPlaceName(String placeName)    { this.placeName = placeName; }

    public String getAddress()                    { return address; }
    public void setAddress(String address)        { this.address = address; }

    public String getReview()                     { return review; }
    public void setReview(String review)          { this.review = review; }

    public String getImageUrl()                   { return imageUrl; }
    public void setImageUrl(String imageUrl)      { this.imageUrl = imageUrl; }

    public Double getLatitude()                   { return latitude; }
    public void setLatitude(Double latitude)      { this.latitude = latitude; }

    public Double getLongitude()                  { return longitude; }
    public void setLongitude(Double longitude)    { this.longitude = longitude; }

    public LocalDateTime getCreatedAt()           { return createdAt; }
    public void setCreatedAt(LocalDateTime t)     { this.createdAt = t; }
}
