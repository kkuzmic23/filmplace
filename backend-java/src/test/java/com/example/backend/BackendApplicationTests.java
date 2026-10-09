package com.example.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"filmplace.security.jwt.secret=test-only-jwt-secret-with-32-characters",
		"spring.datasource.password=test-only-password"
})
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
