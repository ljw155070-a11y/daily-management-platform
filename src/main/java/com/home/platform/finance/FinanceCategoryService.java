package com.home.platform.finance;

import com.home.platform.finance.dto.FinanceCategoryDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@Transactional
public class FinanceCategoryService {

    private static final List<DefaultCategory> DEFAULT_CATEGORIES = List.of(
            new DefaultCategory("EXPENSE", "식비", "🍚", 0),
            new DefaultCategory("EXPENSE", "교통", "🚌", 1),
            new DefaultCategory("EXPENSE", "주거/관리비", "🏠", 2),
            new DefaultCategory("EXPENSE", "통신", "📱", 3),
            new DefaultCategory("EXPENSE", "의료/건강", "🏥", 4),
            new DefaultCategory("EXPENSE", "교육", "📖", 5),
            new DefaultCategory("EXPENSE", "문화/여가", "🎬", 6),
            new DefaultCategory("EXPENSE", "의류/미용", "👔", 7),
            new DefaultCategory("EXPENSE", "경조사", "🎁", 8),
            new DefaultCategory("EXPENSE", "보험", "🛡", 9),
            new DefaultCategory("EXPENSE", "저축/투자", "💰", 10),
            new DefaultCategory("EXPENSE", "기타 지출", "📋", 11),
            new DefaultCategory("INCOME", "급여", "💵", 0),
            new DefaultCategory("INCOME", "부수입", "💼", 1),
            new DefaultCategory("INCOME", "이자/배당", "🏦", 2),
            new DefaultCategory("INCOME", "용돈", "🤝", 3),
            new DefaultCategory("INCOME", "환급", "🔄", 4),
            new DefaultCategory("INCOME", "기타 수입", "📋", 5)
    );

    private final FinanceCategoryRepository repository;

    public FinanceCategoryService(FinanceCategoryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<FinanceCategoryDto> getCategories(String userId, String catType) {
        String normalizedUserId = normalizeUserId(userId);
        String normalizedCatType = normalizeCatType(catType);

        return repository.findByUserIdAndCatTypeOrderBySortOrderAsc(normalizedUserId, normalizedCatType)
                .stream()
                .map(FinanceCategoryDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FinanceCategoryDto> getAllCategories(String userId) {
        return repository.findByUserIdOrderBySortOrderAsc(normalizeUserId(userId))
                .stream()
                .map(FinanceCategoryDto::from)
                .toList();
    }

    public void initDefaultCategories(String userId) {
        String normalizedUserId = normalizeUserId(userId);
        if (!repository.findByUserIdOrderBySortOrderAsc(normalizedUserId).isEmpty()) {
            return;
        }

        List<FinanceCategory> categories = DEFAULT_CATEGORIES.stream()
                .map(defaultCategory -> toEntity(normalizedUserId, defaultCategory))
                .toList();

        repository.saveAll(categories);
    }

    public FinanceCategoryDto addCategory(String userId, String catType, String catName, String icon) {
        String normalizedUserId = normalizeUserId(userId);
        String normalizedCatType = normalizeCatType(catType);
        String normalizedCatName = normalizeCategoryName(catName);
        String normalizedIcon = normalizeIcon(icon);

        if (repository.existsByUserIdAndCatTypeAndCatName(normalizedUserId, normalizedCatType, normalizedCatName)) {
            throw new ResponseStatusException(BAD_REQUEST, "Category already exists.");
        }

        int nextSortOrder = repository.findByUserIdAndCatTypeOrderBySortOrderAsc(normalizedUserId, normalizedCatType)
                .stream()
                .map(FinanceCategory::getSortOrder)
                .filter(sortOrder -> sortOrder != null)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(-1) + 1;

        FinanceCategory category = new FinanceCategory();
        category.setUserId(normalizedUserId);
        category.setCatType(normalizedCatType);
        category.setCatName(normalizedCatName);
        category.setIcon(normalizedIcon);
        category.setSortOrder(nextSortOrder);
        category.setIsDefault("N");

        return FinanceCategoryDto.from(repository.save(category));
    }

    public void deleteCategory(Long id, String userId) {
        Long normalizedId = normalizeId(id);
        String normalizedUserId = normalizeUserId(userId);

        FinanceCategory category = repository.findById(normalizedId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Category not found."));

        if (!normalizedUserId.equals(category.getUserId())) {
            throw new ResponseStatusException(NOT_FOUND, "Category not found.");
        }
        if ("Y".equalsIgnoreCase(category.getIsDefault())) {
            throw new ResponseStatusException(FORBIDDEN, "Default category cannot be deleted.");
        }

        repository.delete(category);
    }

    private FinanceCategory toEntity(String userId, DefaultCategory defaultCategory) {
        FinanceCategory category = new FinanceCategory();
        category.setUserId(userId);
        category.setCatType(defaultCategory.catType());
        category.setCatName(defaultCategory.catName());
        category.setIcon(defaultCategory.icon());
        category.setSortOrder(defaultCategory.sortOrder());
        category.setIsDefault("Y");
        return category;
    }

    private String normalizeUserId(String userId) {
        if (userId == null) {
            throw new ResponseStatusException(BAD_REQUEST, "User id is required.");
        }

        String normalized = userId.trim();
        if (normalized.isEmpty() || normalized.length() > 100) {
            throw new ResponseStatusException(BAD_REQUEST, "User id is invalid.");
        }

        return normalized;
    }

    private String normalizeCatType(String catType) {
        if (catType == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Category type is required.");
        }

        String normalized = catType.trim().toUpperCase();
        if (!"INCOME".equals(normalized) && !"EXPENSE".equals(normalized)) {
            throw new ResponseStatusException(BAD_REQUEST, "Category type is invalid.");
        }

        return normalized;
    }

    private String normalizeCategoryName(String catName) {
        if (catName == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Category name is required.");
        }

        String normalized = catName.trim();
        if (normalized.isEmpty() || normalized.length() > 100) {
            throw new ResponseStatusException(BAD_REQUEST, "Category name is invalid.");
        }

        return normalized;
    }

    private String normalizeIcon(String icon) {
        if (icon == null) {
            return null;
        }

        String normalized = icon.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > 50) {
            throw new ResponseStatusException(BAD_REQUEST, "Icon is invalid.");
        }

        return normalized;
    }

    private Long normalizeId(Long id) {
        if (id == null || id <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Category id is invalid.");
        }

        return id;
    }

    private record DefaultCategory(String catType, String catName, String icon, Integer sortOrder) {
    }
}
