package com.idoc.modules.platform.application;

import com.idoc.modules.platform.api.PlatformAccountApi;
import com.idoc.modules.platform.api.PlatformAccountView;
import com.idoc.modules.platform.domain.PlatformAccountRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
class PlatformAccountApiImpl implements PlatformAccountApi {

    private final PlatformAccountRepository repository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public Optional<PlatformAccountView> findActiveGoogleByEmail(String email) {
        return repository.findFirstByEmail(email)
                .filter(a -> a.isActive() && a.isGoogleEnabled())
                .map(a -> new PlatformAccountView(a.getId(), a.getEmail(), a.getFullName()));
    }

    @Override
    public Optional<PlatformAccountView> verifyPassword(String email, String rawPassword) {
        return repository.findFirstByEmail(email)
                .filter(a -> a.isActive()
                        && a.getPasswordHash() != null
                        && passwordEncoder.matches(rawPassword, a.getPasswordHash()))
                .map(a -> new PlatformAccountView(a.getId(), a.getEmail(), a.getFullName()));
    }
}
