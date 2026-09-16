package com.tnl.logistics.controller;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.context.annotation.Profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

public class TestSecurityControllerProfileTest {

    private final WebApplicationContextRunner contextRunner = new WebApplicationContextRunner()
            .withUserConfiguration(TestSecurityController.class);

    @Test
    void testProfileAnnotationValues() {
        Profile profileAnnotation = TestSecurityController.class.getAnnotation(Profile.class);
        assertNotNull(profileAnnotation, "TestSecurityController must be annotated with @Profile");
        assertThat(profileAnnotation.value()).containsExactlyInAnyOrder("dev", "test");
    }

    @Test
    void testBeanNotLoadedUnderProductionProfile() {
        contextRunner
                .withPropertyValues("spring.profiles.active=prod")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(TestSecurityController.class);
                });
    }

    @Test
    void testBeanLoadedUnderDevProfile() {
        contextRunner
                .withPropertyValues("spring.profiles.active=dev")
                .run(context -> {
                    assertThat(context).hasSingleBean(TestSecurityController.class);
                });
    }

    @Test
    void testBeanLoadedUnderTestProfile() {
        contextRunner
                .withPropertyValues("spring.profiles.active=test")
                .run(context -> {
                    assertThat(context).hasSingleBean(TestSecurityController.class);
                });
    }
}
