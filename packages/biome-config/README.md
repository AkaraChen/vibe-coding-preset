# @vibe-coding-preset/biome-config

```jsonc
{
  "extends": ["@vibe-coding-preset/biome-config/strict"]
}
```

- `base`: formatter, import organization, and stable recommended lint rules.
- `strict`: project/import, unused code, escape-hatch, mutation, complexity, and security rules.
- `type-aware`: strict plus the types domain and experimental Promise rules. This starts Biome's project scanner and type inference engine.
- `react`: strict plus the recommended React domain and Hooks checks.

Only safe fixes should run automatically. Review unsafe fixes such as unused-import removal.
