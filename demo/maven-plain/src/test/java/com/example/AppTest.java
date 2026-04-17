package com.example;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.example.model.Order;
import com.example.model.User;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Smoke tests that exercise both the generated records (User, Order)
 * and the hand-written App wiring. Failure here proves either the
 * template drifted (generated shape changed) or the hand-written
 * code stopped compiling against it.
 */
class AppTest {

    @Test
    void generatedUserRecordCarriesItsComponents() {
        UUID id = UUID.randomUUID();
        User u = new User(id, "Bob", "bob@example.com");
        assertEquals(id, u.id());
        assertEquals("Bob", u.name());
        assertEquals("bob@example.com", u.email());
    }

    @Test
    void recordEqualityIsValueBased() {
        UUID id = UUID.randomUUID();
        assertEquals(new User(id, "X", "x@e.com"), new User(id, "X", "x@e.com"));
        assertNotEquals(new User(id, "X", "x@e.com"), new User(id, "Y", "x@e.com"));
    }

    @Test
    void orderReferenceAttributeStoresUserId() {
        UUID userId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        Order o = new Order(orderId, userId, new BigDecimal("12.34"));
        // `Order.user` is `reference: true` in the model → component type is
        // UUID, not the embedded User record.
        assertEquals(userId, o.user());
        assertNotNull(o.id());
    }

    @Test
    void appWiringStillCompilesAgainstGeneratedRecords() {
        String summary = App.describeSampleOrder();
        assertEquals(
            "Alice placed order 22222222-2222-2222-2222-222222222222 for 49.95",
            summary
        );
    }
}
