package com.home.platform.travel;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "PUBLIC_TRAVEL_COORD_HIST")
public class PublicTravelCoordinateHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "publicTravelCoordHistSeq")
    @SequenceGenerator(name = "publicTravelCoordHistSeq", sequenceName = "PUBLIC_TRAVEL_COORD_HIST_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "EXTERNAL_CONTENT_ID", nullable = false, length = 50)
    private String externalContentId;

    @Column(name = "LATITUDE", nullable = false)
    private Double latitude;

    @Column(name = "LONGITUDE", nullable = false)
    private Double longitude;

    @Column(name = "REASON", length = 500)
    private String reason;

    @Column(name = "ACTIVE_FLAG", nullable = false, length = 1)
    private String activeFlag = "Y";

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "LAST_APPLIED_AT")
    private LocalDateTime lastAppliedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getExternalContentId() { return externalContentId; }
    public void setExternalContentId(String externalContentId) { this.externalContentId = externalContentId; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getActiveFlag() { return activeFlag; }
    public void setActiveFlag(String activeFlag) { this.activeFlag = activeFlag; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public LocalDateTime getLastAppliedAt() { return lastAppliedAt; }
    public void setLastAppliedAt(LocalDateTime lastAppliedAt) { this.lastAppliedAt = lastAppliedAt; }
}
