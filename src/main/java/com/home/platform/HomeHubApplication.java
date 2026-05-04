package com.home.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HomeHubApplication {
    public static void main(String[] args) {
        SpringApplication.run(HomeHubApplication.class, args);
    }
}
