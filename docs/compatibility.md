# Mofang JSON 兼容矩阵

| 字段 | 状态 |
|---|---|
| basic.name / title / email / phone / location / photo / birthDate / employementStatus | Supported |
| basic.customFields → links | Supported |
| experience / education / projects / skillContent / certificates | Supported |
| menuSections + customData → customSections | Supported |
| basic.photoConfig / fieldOrder / icons / github* | Preserved (`extras.mofang`) |
| globalSettings / templateId / menuSections 原文 | Preserved |
| skillContent / selfEvaluationContent HTML | Partially Supported（转 points，原文 extras） |
| Magic Resume 主题 / 模板皮肤 | Ignored（不进 Canonical / Presentation） |
| yiyue layout / theme / orientation | 不写入魔方导出 |

规则：已映射字段以 Canonical 为真相；未映射以 `extras.mofang` 为真相。
