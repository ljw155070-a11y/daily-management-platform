package com.home.platform.travel;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Service
public class TravelPlaceImageStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".gif", ".webp");

    private final Path uploadDirectory;

    public TravelPlaceImageStorageService(@Value("${travel.place.image-dir:uploads/travel-place}") String imageDir) {
        this.uploadDirectory = Path.of(imageDir).toAbsolutePath().normalize();
    }

    public String store(MultipartFile imageFile) {
        if (imageFile == null || imageFile.isEmpty()) {
            return null;
        }

        String contentType = imageFile.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("이미지 파일만 업로드할 수 있습니다.");
        }

        String extension = resolveExtension(imageFile.getOriginalFilename());
        try {
            Files.createDirectories(uploadDirectory);
            String storedName = UUID.randomUUID() + extension;
            Path target = uploadDirectory.resolve(storedName).normalize();
            Files.copy(imageFile.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return "/travel/place-images/" + storedName;
        } catch (IOException e) {
            throw new IllegalStateException("이미지를 저장하지 못했습니다.", e);
        }
    }

    public void deleteIfPresent(String imageUrl) {
        if (!StringUtils.hasText(imageUrl)) {
            return;
        }

        String fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
        Path path = uploadDirectory.resolve(fileName).normalize();
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }

    public Path resolve(String fileName) {
        return uploadDirectory.resolve(fileName).normalize();
    }

    private String resolveExtension(String originalFilename) {
        String candidate = "";
        if (StringUtils.hasText(originalFilename) && originalFilename.lastIndexOf('.') >= 0) {
            candidate = originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase();
        }
        if (!ALLOWED_EXTENSIONS.contains(candidate)) {
            candidate = ".jpg";
        }
        return candidate;
    }
}
