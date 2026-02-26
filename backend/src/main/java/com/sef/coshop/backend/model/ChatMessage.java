package com.sef.coshop.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sender;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String roomId;

    private LocalDateTime timestamp;

    private String type; // MESSAGE, TYPING, STOP_TYPING

    public ChatMessage() {
    }

    public ChatMessage(String sender, String content, String roomId, LocalDateTime timestamp, String type) {
        this.sender = sender;
        this.content = content;
        this.roomId = roomId;
        this.timestamp = timestamp;
        this.type = type;
    }

    // Getter & Setter

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    @Override
    public String toString() {
        return "ChatMessage{" +
                "sender='" + sender + '\'' +
                ", content='" + content + '\'' +
                ", roomId='" + roomId + '\'' +
                ", timestamp=" + timestamp +
                ", type='" + type + '\'' +
                '}';
    }
}