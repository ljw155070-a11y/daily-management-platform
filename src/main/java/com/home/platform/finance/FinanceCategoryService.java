package com.home.platform.finance;

import com.home.platform.finance.dto.FinanceCategoryDto;
import com.home.platform.finance.dto.FinanceCategoryOrderRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@Transactional
public class FinanceCategoryService {

    private static final List<DefaultCategory> DEFAULT_CATEGORIES = List.of(
            new DefaultCategory("EXPENSE", "식비", "utensils", 1),
            new DefaultCategory("EXPENSE", "교통", "bus", 2),
            new DefaultCategory("EXPENSE", "주거/관리비", "home", 3),
            new DefaultCategory("EXPENSE", "통신", "smartphone", 4),
            new DefaultCategory("EXPENSE", "의료/건강", "heart-pulse", 5),
            new DefaultCategory("EXPENSE", "교육", "book-open", 6),
            new DefaultCategory("EXPENSE", "문화/여가", "film", 7),
            new DefaultCategory("EXPENSE", "의류/미용", "shirt", 8),
            new DefaultCategory("EXPENSE", "경조사", "gift", 9),
            new DefaultCategory("EXPENSE", "보험", "shield", 10),
            new DefaultCategory("EXPENSE", "저축/투자", "piggy-bank", 11),
            new DefaultCategory("EXPENSE", "기타 지출", "clipboard-list", 12),
            new DefaultCategory("INCOME", "급여", "wallet", 1),
            new DefaultCategory("INCOME", "부수입", "briefcase", 2),
            new DefaultCategory("INCOME", "이자/배당", "landmark", 3),
            new DefaultCategory("INCOME", "용돈", "hand-coins", 4),
            new DefaultCategory("INCOME", "환급", "rotate-ccw", 5),
            new DefaultCategory("INCOME", "기타 수입", "file-text", 6)
    );

    private final FinanceCategoryRepository repository;
    private final FinanceTxRepository txRepository;
    private final FinanceBudgetRepository budgetRepository;

    public FinanceCategoryService(
            FinanceCategoryRepository repository,
            FinanceTxRepository txRepository,
            FinanceBudgetRepository budgetRepository
    ) {
        this.repository = repository;
        this.txRepository = txRepository;
        this.budgetRepository = budgetRepository;
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
        List<FinanceCategory> existingCategories = repository.findByUserIdOrderBySortOrderAsc(normalizedUserId);
        if (existingCategories.isEmpty()) {
            List<FinanceCategory> categories = DEFAULT_CATEGORIES.stream()
                    .map(defaultCategory -> toEntity(normalizedUserId, defaultCategory))
                    .toList();

            repository.saveAll(categories);
            return;
        }

        reconcileDefaultCategories(normalizedUserId, existingCategories);
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
                .orElse(0) + 1;

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

    private void reconcileDefaultCategories(String userId, List<FinanceCategory> existingCategories) {
        List<FinanceCategory> existingDefaultCategories = existingCategories.stream()
                .filter(category -> "Y".equalsIgnoreCase(category.getIsDefault()))
                .toList();

        Map<String, FinanceCategory> defaultCategoryMap = existingDefaultCategories.stream()
                .filter(category -> category.getSortOrder() != null)
                .collect(Collectors.toMap(
                        category -> defaultKey(category.getCatType(), category.getSortOrder()),
                        Function.identity(),
                        (left, right) -> left
                ));

        List<FinanceCategory> categoriesToSave = DEFAULT_CATEGORIES.stream()
                .map(defaultCategory -> syncDefaultCategory(
                        userId,
                        defaultCategory,
                        defaultCategoryMap.get(defaultKey(defaultCategory.catType(), defaultCategory.sortOrder()))
                ))
                .toList();

        repository.saveAll(categoriesToSave);
        cleanupStaleDefaultCategories(existingDefaultCategories);
    }

    private void cleanupStaleDefaultCategories(List<FinanceCategory> existingDefaultCategories) {
        Set<String> expectedDefaultKeys = DEFAULT_CATEGORIES.stream()
                .map(defaultCategory -> defaultKey(defaultCategory.catType(), defaultCategory.sortOrder()))
                .collect(Collectors.toSet());

        existingDefaultCategories.stream()
                .filter(category -> !expectedDefaultKeys.contains(defaultKey(category.getCatType(), category.getSortOrder())))
                .forEach(this::cleanupStaleDefaultCategory);
    }

    private void cleanupStaleDefaultCategory(FinanceCategory category) {
        long txCount = txRepository.countByCategoryId(category.getId());
        long budgetCount = budgetRepository.countByCategoryId(category.getId());

        if (txCount == 0 && budgetCount == 0) {
            repository.delete(category);
            return;
        }

        category.setIsDefault("N");
        repository.save(category);
    }

    private FinanceCategory syncDefaultCategory(String userId, DefaultCategory defaultCategory, FinanceCategory existingCategory) {
        FinanceCategory category = existingCategory != null ? existingCategory : new FinanceCategory();
        category.setUserId(userId);
        category.setCatType(defaultCategory.catType());
        category.setCatName(defaultCategory.catName());
        category.setIcon(defaultCategory.icon());
        category.setSortOrder(defaultCategory.sortOrder());
        category.setIsDefault("Y");
        return category;
    }

    private String defaultKey(String catType, Integer sortOrder) {
        return catType + ":" + sortOrder;
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
