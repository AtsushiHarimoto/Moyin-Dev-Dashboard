/**
 * 共享的領域預設分類
 * 來源：Hermit Purple 配置（keywords.yaml categories）
 * 同時用於 AnalysisTrigger（觸發分析）和 ReportsManager（篩選報告）
 * 最後更新：2026-02-22
 */

export interface DomainPreset {
  /** i18n key（優先） */
  labelKey?: string;
  /** 直接顯示的標籤 */
  label?: string;
  /** i18n key for description */
  descriptionKey?: string;
  icon: string;
  /** 逗號分隔的關鍵詞 */
  keywords: string;
}

export const DOMAIN_PRESETS: DomainPreset[] = [
  {
    label: 'VibeCoding',
    descriptionKey: 'analysis.preset.vibeCoding.desc',
    icon: '⚡',
    keywords:
      // 核心概念
      'vibecoding, vibe coding, agentic coding, agentic workflows, agentic IDE, agentic cli, ' +
      'ai native ide, context engineering, spec-driven development, prompt-to-app, multi-agent coding, ' +
      // Anthropic 生態
      'claude code, claude skills, skills.sh, anthropic, claude artifacts, ' +
      'mcp, model context protocol, mcp server, fastmcp, mcp registry, ' +
      // 協議與標準
      'a2a, agent-to-agent protocol, agent client protocol, agents.md, agentic ai foundation, ' +
      // IDE 與工具
      'cursor, cursor agent, cursor background agents, windsurf, windsurf cascade, ' +
      'kiro, google jules, google antigravity, trae, ' +
      'cline, aider, continue.dev, copilot, github copilot, codex cli, ' +
      'amazon q developer, gemini code assist, gemini cli, tabnine, cody, ' +
      // AI 應用建構
      'replit agent, bolt.new, lovable, v0.dev, manus ai, devin, ' +
      'augment code, openhands, opencode, goose, zencoder, ' +
      // 編碼模型 & 通用
      'qwen coder, deepseek coder, codestral, starcoder, ' +
      'ai pair programming, ai coding assistant, autonomous coding, autonomous ai agents, ' +
      'swe-agent, composio',
  },
  {
    label: 'AI量化交易',
    labelKey: 'analysis.preset.quantTrading',
    descriptionKey: 'analysis.preset.quantTrading.desc',
    icon: '📈',
    keywords:
      // 核心概念
      'ai quantitative trading, ai stock analysis, ai trading, algorithmic trading, ' +
      'agentic trading, vibe trading, ' +
      // 開源框架
      'FinRL, Qlib, vnpy, QuantConnect, LEAN, freqtrade, backtrader, backtesting.py, zipline, ' +
      // AI 金融模型
      'FinBERT, FinGPT, FinLLM, sentiment analysis trading, ' +
      'LSTM stock prediction, reinforcement learning trading, LLM financial reasoning, ' +
      // 策略與方法
      'alpha factor mining, formulaic alpha, portfolio optimization, risk management, backtest, ' +
      'regime-adaptive strategy, multi-modal market analysis, ' +
      // 平台與工具
      'Composer, AlgosOne, TrendSpider, NexusTrade, ' +
      // 加密 & DeFi
      'DeFi AI agents, Pionex, Cryptohopper, 3Commas, ' +
      // 中國生態
      'A股量化, 量化交易, 聚寬, BigQuant, TuShare, TradeMaster, High-Flyer Quant, ' +
      // 通用
      'ai portfolio, quant strategy, trading bot, high frequency trading, alternative data',
  },
  {
    label: 'AI影視生成',
    labelKey: 'analysis.preset.videoGen',
    descriptionKey: 'analysis.preset.videoGen.desc',
    icon: '🎬',
    keywords:
      // 影片生成平台
      'ai video generation, ai animation, ai漫劇, ai短劇, ' +
      'sora, sora 2, veo 3, kling, kling 3.0, runway, runway gen-4, ' +
      'pika, luma, minimax video, hailuo, heygen, wan2.1, vidu, seedance, ' +
      'pixverse, ltx studio, domo ai, viggle, ' +
      // 影片生成概念
      'text to video, image to video, video to video, ' +
      'ai film, ai cinematography, ai vfx, ai dubbing, ' +
      'world model, multi-shot storyboarding, ai audio-visual generation, ' +
      // 圖片生成
      'ai image generation, flux, flux 2, stable diffusion, sd webui, midjourney, ' +
      'ideogram, recraft, gpt-4o image generation, leonardo ai, magnific ai, krea ai, ' +
      // ComfyUI 生態
      'comfyui, comfyui video, comfyui workflow, comfyui cloud, ' +
      // 技術概念
      'character consistency, ip adapter, ai style transfer, ai text in image, ' +
      'consistory, animatediff, ' +
      // 開源影片模型
      'hunyuan video, cogvideox, mochi, ltx video, skyreels',
  },
  {
    label: 'LLM開源動態',
    labelKey: 'analysis.preset.llmOpenSource',
    descriptionKey: 'analysis.preset.llmOpenSource.desc',
    icon: '🧠',
    keywords:
      // 核心概念
      'open source llm, local llm, 開源大模型, ' +
      // 主要模型
      'deepseek, deepseek r1, deepseek v3, qwen, qwen3, llama, llama 4, ' +
      'mistral, mistral large, gemma, gemma 3, phi-4, ' +
      'glm, glm-5, chatglm, ernie 4.5, yi, ' +
      'command r+, dbrx, jamba, nemotron, internlm, 通義千問, 文心一言, ' +
      // 推理引擎
      'ollama, vllm, llama.cpp, lm studio, localai, ' +
      'sglang, tensorrt-llm, exllamav2, mlc llm, groq, ' +
      // 微調工具與技術
      'LoRA, QLoRA, unsloth, axolotl, llama-factory, torchtune, openrlhf, ' +
      'fine tuning, GGUF, GPTQ, AWQ, grpo, dpo, orpo, ' +
      // Agent 框架
      'langchain, langgraph, llamaindex, crewai, semantic kernel, ' +
      'openai agents sdk, google adk, smolagents, pydantic ai, agno, dspy, mastra, ' +
      // RAG 生態
      'rag, agentic rag, graphrag, lightrag, dify, firecrawl, ragas, deepeval, langfuse, ' +
      // 應用場景
      'ai story generation, ai novel writing, npc dialogue, narrative ai, ' +
      'small language model, edge ai, on device inference',
  },
  {
    label: 'AI語音克隆',
    labelKey: 'analysis.preset.voiceClone',
    descriptionKey: 'analysis.preset.voiceClone.desc',
    icon: '🎙️',
    keywords:
      // 核心概念
      'voice cloning, ai voice, 語音克隆, 語音合成, ' +
      // TTS 通用
      'tts, text to speech, 中文tts, 粵語tts, 國語語音合成, zero shot tts, few shot voice cloning, ' +
      // TTS 模型（經典）
      'GPT-SoVITS, CosyVoice, cosyvoice2, fish audio, fish speech, ' +
      'VITS, XTTS, Coqui TTS, PaddleSpeech, MeloTTS, ChatTTS, EmotiVoice, ' +
      // TTS 模型（2025-2026 新）
      'orpheus tts, kokoro tts, sesame csm, f5-tts, spark tts, dia tts, ' +
      'chatterbox tts, qwen3-tts, zonos tts, styletts2, openvoice, bark tts, mars5 tts, indextts, ' +
      // ASR 語音辨識
      'asr, speech recognition, 中文asr, whisper, funASR, ' +
      'sense voice, moonshine, nvidia canary, voxtral, ' +
      // 語音轉換 & 平台
      'voice conversion, speaker diarization, real time voice clone, ' +
      'elevenlabs, rvc, ai lip sync, ai dubbing voice, kimi audio',
  },
  {
    label: 'AI軟體工程',
    labelKey: 'analysis.preset.softwareEng',
    descriptionKey: 'analysis.preset.softwareEng.desc',
    icon: '🔧',
    keywords:
      // 核心概念
      'ai software engineering, ai devops, ai native development, ai first development, ' +
      'agentic sdlc, software 2.0, ' +
      // 測試
      'ai testing, ai test generation, visual regression testing, ai qa automation, ' +
      'self healing tests, self-healing selectors, flake detection, Katalon, mabl, testRigor, ' +
      // 代碼審查
      'ai code review, automated code review, CodeRabbit, qodo, codescene, moderne, DeepSource, Graphite, ' +
      // 安全
      'Semgrep, Checkmarx, ai sast, ai dast, software composition analysis, AI BOM, supply chain security ai, ' +
      // 可觀測性
      'ai observability, langfuse, arize ai, braintrust, ai gateway, LLM observability, ' +
      // CI/CD & 自動化
      'ai ci cd, ai pull request, autonomous refactoring, technical debt ai, ai architecture, prompt engineering, ' +
      // 文件生成
      'Mintlify, ai documentation, ' +
      // 基準測試
      'swe bench, swe-bench verified, LiveCodeBench, Terminal-Bench, humaneval, mbpp, ai coding benchmark',
  },
];
