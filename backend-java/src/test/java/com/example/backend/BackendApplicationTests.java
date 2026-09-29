package com.example.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "filmplace.security.jwt.secret=test-only-jwt-secret")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
