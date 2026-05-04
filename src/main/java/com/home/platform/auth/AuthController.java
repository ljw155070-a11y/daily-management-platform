package com.home.platform.auth;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.Locale;

@Controller
public class AuthController {

    private final AppUserService appUserService;

    public AuthController(AppUserService appUserService) {
        this.appUserService = appUserService;
    }

    @GetMapping("/login")
    public String login(
            Authentication authentication,
            @RequestParam(name = "error", required = false) String error,
            @RequestParam(name = "logout", required = false) String logout,
            @RequestParam(name = "registered", required = false) String registered,
            Locale locale,
            Model model
    ) {
        if (isAuthenticated(authentication)) {
            return "redirect:/travel?lang=" + locale.getLanguage();
        }

        model.addAttribute("activeTab", "auth");
        model.addAttribute("loginError", error != null);
        model.addAttribute("loggedOut", logout != null);
        model.addAttribute("registered", registered != null);
        return "auth/login";
    }

    @GetMapping("/register")
    public String register(Authentication authentication, Locale locale, Model model) {
        if (isAuthenticated(authentication)) {
            return "redirect:/travel?lang=" + locale.getLanguage();
        }

        model.addAttribute("activeTab", "auth");
        model.addAttribute("registerRequest", new RegisterRequest());
        return "auth/register";
    }

    @PostMapping("/register")
    public String register(
            Authentication authentication,
            @ModelAttribute RegisterRequest registerRequest,
            Locale locale,
            Model model,
            RedirectAttributes redirectAttributes
    ) {
        if (isAuthenticated(authentication)) {
            return "redirect:/travel?lang=" + locale.getLanguage();
        }

        try {
            appUserService.register(registerRequest);
            redirectAttributes.addAttribute("registered", "true");
            redirectAttributes.addAttribute("lang", locale.getLanguage());
            return "redirect:/login";
        } catch (IllegalArgumentException ex) {
            model.addAttribute("activeTab", "auth");
            model.addAttribute("registerRequest", registerRequest);
            model.addAttribute("registerError", ex.getMessage());
            return "auth/register";
        } catch (Exception ex) {
            model.addAttribute("activeTab", "auth");
            model.addAttribute("registerRequest", registerRequest);
            model.addAttribute("registerError", ex.getClass().getSimpleName() + ": " + ex.getMessage());
            return "auth/register";
        }
    }

    private boolean isAuthenticated(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }
}
