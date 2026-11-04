package com.example.AIoTLibTQB.document;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ComfortScoreRecord {
    Double overall;
    String grade;
    Double acousticScore;
    Double airScore;
    Double thermalScore;
    Double lightScore;
}
