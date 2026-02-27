package com.sef.coshop.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CodeDeliveryService {

    private final JavaMailSender mailSender;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${app.sms.twilio.account-sid:}")
    private String twilioAccountSid;

    @Value("${app.sms.twilio.auth-token:}")
    private String twilioAuthToken;

    @Value("${app.sms.twilio.from-number:}")
    private String twilioFromNumber;

    @Value("${app.sms.twilio.verify-service-sid:}")
    private String twilioVerifyServiceSid;

    public void sendVerificationCode(String identifier, String code) {
        if (identifier.contains("@")) {
            String body = "Coshop dogrulama kodunuz: " + code + ". Kod 10 dakika gecerlidir.";
            sendByIdentifier(identifier, "Coshop Hesap Dogrulama Kodu", body);
            return;
        }

        startPhoneVerification(identifier);
    }

    public void sendResetCode(String identifier, String code) {
        if (identifier.contains("@")) {
            String body = "Coshop sifre sifirlama kodunuz: " + code + ". Kod 10 dakika gecerlidir.";
            sendByIdentifier(identifier, "Coshop Sifre Sifirlama Kodu", body);
            return;
        }

        startPhoneVerification(identifier);
    }

    public boolean verifyPhoneCode(String phone, String code) {
        if (isBlank(code)) {
            return false;
        }
        if (isBlank(twilioAccountSid) || isBlank(twilioAuthToken) || isBlank(twilioVerifyServiceSid)) {
            throw new IllegalStateException("Twilio Verify ayarlari eksik.");
        }

        String url = "https://verify.twilio.com/v2/Services/" + twilioVerifyServiceSid + "/VerificationCheck";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(twilioAccountSid, twilioAuthToken);

        MultiValueMap<String, String> payload = new LinkedMultiValueMap<>();
        payload.add("To", phone);
        payload.add("Code", code);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(payload, headers);
        Map<?, ?> response = restTemplate.postForObject(url, request, Map.class);

        Object status = response == null ? null : response.get("status");
        return "approved".equalsIgnoreCase(status == null ? "" : status.toString());
    }

    private void sendByIdentifier(String identifier, String subject, String body) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalStateException("Gonderim hedefi bos olamaz.");
        }

        if (identifier.contains("@")) {
            sendEmail(identifier.trim().toLowerCase(), subject, body);
        } else {
            sendSms(identifier.trim(), body);
        }
    }

    private void sendEmail(String to, String subject, String body) {
        if (mailFrom == null || mailFrom.isBlank()) {
            throw new IllegalStateException("E-posta gonderimi icin app.mail.from ayari eksik.");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }

    private void sendSms(String to, String body) {
        if (isBlank(twilioAccountSid) || isBlank(twilioAuthToken) || isBlank(twilioFromNumber)) {
            throw new IllegalStateException("SMS gonderimi icin Twilio ayarlari eksik.");
        }

        String url = "https://api.twilio.com/2010-04-01/Accounts/" + twilioAccountSid + "/Messages.json";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(twilioAccountSid, twilioAuthToken);

        MultiValueMap<String, String> payload = new LinkedMultiValueMap<>();
        payload.add("To", to);
        payload.add("From", twilioFromNumber);
        payload.add("Body", body);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(payload, headers);
        restTemplate.postForEntity(url, request, String.class);
    }

    private void startPhoneVerification(String phone) {
        if (isBlank(twilioAccountSid) || isBlank(twilioAuthToken) || isBlank(twilioVerifyServiceSid)) {
            throw new IllegalStateException("Twilio Verify ayarlari eksik.");
        }

        String url = "https://verify.twilio.com/v2/Services/" + twilioVerifyServiceSid + "/Verifications";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(twilioAccountSid, twilioAuthToken);

        MultiValueMap<String, String> payload = new LinkedMultiValueMap<>();
        payload.add("To", phone);
        payload.add("Channel", "sms");

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(payload, headers);
        restTemplate.postForEntity(url, request, String.class);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
