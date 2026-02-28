import { describe, it, expect } from 'vitest';
import { parseInsightsFromMarkdown } from '../runner';

describe('parseInsightsFromMarkdown', () => {
  // --- Legacy format tests (backward compatibility) ---
  describe('legacy bullet-point format', () => {
    const sampleMarkdown = `# AI Trends Report

This week saw a surge in MCP adoption across developer tools.

## Adopt (建議採用)

- **MCP Protocol**: Growing ecosystem
- **Claude Code**: Strong developer adoption

## Hold (觀望)

- **AutoGPT**: Performance concerns remain

## Drop (淘汰)

- **LangChain v0.1**: Superseded by v0.3
`;

    it('extracts adopt/hold lists from markdown (drop is excluded from new structure)', () => {
      const result = parseInsightsFromMarkdown(sampleMarkdown);

      expect(result.adopt).toEqual(['MCP Protocol', 'Claude Code']);
      expect(result.hold).toEqual(['AutoGPT']);
      // drop items are ignored in the new structure (no drop ring)
      expect(result.trial).toEqual([]);
      expect(result.assess).toEqual([]);
    });

    it('populates items array from legacy format', () => {
      const result = parseInsightsFromMarkdown(sampleMarkdown);
      expect(result.items).toHaveLength(3); // adopt(2) + hold(1), drop excluded
      expect(result.items[0]).toMatchObject({ name: 'MCP Protocol', ring: 'adopt' });
      expect(result.items[2]).toMatchObject({ name: 'AutoGPT', ring: 'hold' });
    });

    it('extracts summary paragraph', () => {
      const result = parseInsightsFromMarkdown(sampleMarkdown);
      expect(result.summary).toContain('surge in MCP');
    });

    it('handles empty markdown gracefully', () => {
      const result = parseInsightsFromMarkdown('');
      expect(result.adopt).toEqual([]);
      expect(result.trial).toEqual([]);
      expect(result.assess).toEqual([]);
      expect(result.hold).toEqual([]);
      expect(result.items).toEqual([]);
      expect(result.summary).toBe('');
    });

    it('handles markdown with no matching sections', () => {
      const md = `# Random Document

Just some text here without any adopt/hold/drop sections.

## Unrelated Section

- Item A
- Item B
`;
      const result = parseInsightsFromMarkdown(md);
      expect(result.adopt).toEqual([]);
      expect(result.hold).toEqual([]);
      expect(result.items).toEqual([]);
    });

    it('handles Chinese section names', () => {
      const md = `# AI 報告

本週的趨勢觀察重點。

## 建議採用

- **Tool A**: 很好用

## 觀望

- **Tool B**: 待觀察

## 淘汰

- **Tool C**: 已過時
`;
      const result = parseInsightsFromMarkdown(md);
      expect(result.adopt).toEqual(['Tool A']);
      expect(result.hold).toEqual(['Tool B']);
      // drop/淘汰 excluded from new structure
    });

    it('handles legacy trial/assess sections', () => {
      const md = `# Report

Overview of trends.

## Adopt

- **A**: good

## Trial (值得試驗)

- **B**: worth trying

## Assess (持續觀察)

- **C**: watching

## Hold (謹慎觀望)

- **D**: careful
`;
      const result = parseInsightsFromMarkdown(md);
      expect(result.adopt).toEqual(['A']);
      expect(result.trial).toEqual(['B']);
      expect(result.assess).toEqual(['C']);
      expect(result.hold).toEqual(['D']);
      expect(result.items).toHaveLength(4);
    });
  });

  // --- New Trend Card format tests ---
  describe('new Trend Card format', () => {
    const trendCardMarkdown = `# AI Trends Weekly Report

This week saw significant movement in AI tooling landscape.

## Adopt (建議採用)

#### MCP Protocol

\`工具\` \`↑ Rising\` \`⬤ 0.92\`

**信號**: GitHub stars 突破 10k，主要 IDE 均已整合

#### Claude Code

\`工具\` \`↑ Rising\` \`⬤ 0.88\`

**信號**: 開發者社群正面回饋持續增長

## Trial (值得試驗)

#### Cursor AI

\`工具\` \`↑ Rising\` \`⬤ 0.75\`

**信號**: 新版本功能大幅提升

## Assess (持續觀察)

#### Devin

\`平台\` \`→ Stable\` \`⬤ 0.55\`

**信號**: 商業模式仍在驗證中

## Hold (謹慎觀望)

#### AutoGPT

\`平台\` \`↓ Declining\` \`⬤ 0.3\`

**信號**: 社群活躍度持續下降
`;

    it('extracts trend cards with full metadata', () => {
      const result = parseInsightsFromMarkdown(trendCardMarkdown);

      expect(result.items).toHaveLength(5);

      const mcp = result.items[0];
      expect(mcp.name).toBe('MCP Protocol');
      expect(mcp.ring).toBe('adopt');
      expect(mcp.quadrant).toBe('tools');
      expect(mcp.trendDirection).toBe('rising');
      expect(mcp.confidence).toBeCloseTo(0.92);
      expect(mcp.signal).toContain('GitHub stars');
    });

    it('correctly categorizes items into ring arrays', () => {
      const result = parseInsightsFromMarkdown(trendCardMarkdown);

      expect(result.adopt).toEqual(['MCP Protocol', 'Claude Code']);
      expect(result.trial).toEqual(['Cursor AI']);
      expect(result.assess).toEqual(['Devin']);
      expect(result.hold).toEqual(['AutoGPT']);
    });

    it('extracts quadrant correctly', () => {
      const result = parseInsightsFromMarkdown(trendCardMarkdown);

      const devin = result.items.find(i => i.name === 'Devin');
      expect(devin?.quadrant).toBe('platforms');

      const claude = result.items.find(i => i.name === 'Claude Code');
      expect(claude?.quadrant).toBe('tools');
    });

    it('extracts trend direction correctly', () => {
      const result = parseInsightsFromMarkdown(trendCardMarkdown);

      const autogpt = result.items.find(i => i.name === 'AutoGPT');
      expect(autogpt?.trendDirection).toBe('declining');

      const devin = result.items.find(i => i.name === 'Devin');
      expect(devin?.trendDirection).toBe('stable');
    });

    it('extracts summary from Trend Card format', () => {
      const result = parseInsightsFromMarkdown(trendCardMarkdown);
      expect(result.summary).toContain('significant movement');
    });
  });

  // --- Template actual output format: inline tags on #### heading ---
  describe('template output format (inline tags with URL)', () => {
    const templateMarkdown = `# 🌸 VibeCoding 生態週報

本週 AI 工具生態快速演進。

## 🟢 建議採用 (Adopt)

#### [MCP Protocol](https://example.com/mcp) \`工具\` \`↑ 上升\` \`⬤ 0.92\`

**信號**: GitHub stars 突破 10k
**證據**:
- 三家企業已投入生產環境
**來源**: GitHub | **作者**: Anthropic

#### [Claude Code](https://example.com/cc) \`工具\` \`↑ 上升\` \`⬤ 0.88\`

**信號**: 開發者社群正面回饋

## 🔴 謹慎觀望 (Hold)

#### [AutoGPT](https://example.com/agpt) \`平台\` \`↓ 下降\` \`⬤ 0.3\`

**信號**: 社群活躍度下降
`;

    it('parses heading with [Name](url) and inline backtick tags', () => {
      const result = parseInsightsFromMarkdown(templateMarkdown);

      expect(result.items).toHaveLength(3);
      expect(result.adopt).toEqual(['MCP Protocol', 'Claude Code']);
      expect(result.hold).toEqual(['AutoGPT']);
    });

    it('extracts metadata from inline tags on heading line', () => {
      const result = parseInsightsFromMarkdown(templateMarkdown);

      const mcp = result.items[0];
      expect(mcp.name).toBe('MCP Protocol');
      expect(mcp.ring).toBe('adopt');
      expect(mcp.quadrant).toBe('tools');
      expect(mcp.confidence).toBeCloseTo(0.92);
      expect(mcp.signal).toContain('GitHub stars');
    });

    it('extracts trend direction from Chinese labels', () => {
      const result = parseInsightsFromMarkdown(templateMarkdown);

      const mcp = result.items.find(i => i.name === 'MCP Protocol');
      expect(mcp?.trendDirection).toBe('rising');

      const agpt = result.items.find(i => i.name === 'AutoGPT');
      expect(agpt?.trendDirection).toBe('declining');
    });
  });
});
