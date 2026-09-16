package com.tnl.logistics.security;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Canonicalizes usernames before they are persisted or used for authentication.
 */
public final class UsernameNormalizer {

    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9._-]{2,49}$");

    private UsernameNormalizer() {
    }

    public static String normalize(String username) {
        if (username == null) {
            throw new IllegalArgumentException("Username is required.");
        }

        String normalizedUsername = username.trim().toLowerCase(Locale.ROOT);
        if (!USERNAME_PATTERN.matcher(normalizedUsername).matches()) {
            throw new IllegalArgumentException(
                    "Username must be 3 to 50 characters and use only lowercase letters, numbers, periods, underscores, or hyphens.");
        }
        return normalizedUsername;
    }
}
