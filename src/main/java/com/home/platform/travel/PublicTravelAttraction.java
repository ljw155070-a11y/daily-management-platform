package com.home.platform.travel;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "PUBLIC_TRAVEL_ATTRACTION")
public class PublicTravelAttraction {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "publicTravelAttractionSeq")
    @SequenceGenerator(name = "publicTravelAttractionSeq", sequenceName = "PUBLIC_TRAVEL_ATTRACTION_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "EXTERNAL_CONTENT_ID", nullable = false, length = 50, unique = true)
    private String externalContentId;

    @Column(name = "TITLE", nullable = false, length = 300)
    private String title;

    @Column(name = "ADDRESS", length = 500)
    private String address;

    @Column(name = "IMAGE_URL", length = 1000)
    private String imageUrl;

    @Column(name = "LATITUDE")
    private Double latitude;

    @Column(name = "LONGITUDE")
    private Double longitude;

    @Column(name = "AREA_CODE", length = 20)
    private String areaCode;

    @Column(name = "ACTIVE_FLAG", nullable = false, length = 1)
    private String activeFlag = "Y";

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "LAST_SYNCED_AT", nullable = false)
    private LocalDateTime lastSyncedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        this.lastSyncedAt = now;
        if (this.activeFlag == null || this.activeFlag.isBlank()) {
            this.activeFlag = "Y";
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public boolean isActive() {
        return "Y".equalsIgnoreCase(activeFlag);
    }

    public void setActive(boolean active) {
        this.activeFlag = active ? "Y" : "N";
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getExternalContentId() { return externalContentId; }
    public void setExternalContentId(String externalContentId) { this.externalContentId = externalContentId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getAreaCode() { return areaCode; }
    public void setAreaCode(String areaCode) { this.areaCode = areaCode; }

    public String getActiveFlag() { return activeFlag; }
    public void setActiveFlag(String activeFlag) { this.activeFlag = activeFlag; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public LocalDateTime getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(LocalDateTime lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }
}
