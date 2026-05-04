package com.home.platform.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MainController {

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("activeTab", "home");
        return "index";
    }

    @GetMapping("/education")
    public String education(Model model) {
        model.addAttribute("activeTab", "education");
        return "education/index";
    }

    @GetMapping("/health")
    public String health(Model model) {
        model.addAttribute("activeTab", "health");
        return "health/index";
    }
}
