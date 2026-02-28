/**
 * Domain presets seed data — backend-side copy.
 *
 * Source of truth: gui/src/constants/domainPresets.ts
 * This file mirrors the preset structure for backend seeding.
 * Only label, icon, keywords, labelKey, descriptionKey are needed.
 */

export interface DomainPreset {
  labelKey?: string;
  label?: string;
  descriptionKey?: string;
  icon: string;
  keywords: string;
}

export const DOMAIN_PRESETS: DomainPreset[] = [
  {
    label: 'VibeCoding',
    descriptionKey: 'analysis.preset.vibeCoding.desc',
    icon: '⚡',
    keywords:
      'vibecoding, vibe coding, agentic coding, agentic workflows, agentic IDE, agentic cli, ' +
      'ai native ide, context engineering, spec-driven development, prompt-to-app, multi-agent coding, ' +
      'claude code, claude skills, skills.sh, anthropic, claude artifacts, ' +
      'mcp, model context protocol, mcp server, fastmcp, mcp registry, ' +
      'a2a, agent-to-agent protocol, agent client protocol, agents.md, agentic ai foundation, ' +
      'cursor, cursor agent, cursor background agents, windsurf, windsurf cascade, ' +
      'kiro, google jules, google antigravity, trae, ' +
      'cline, aider, continue.dev, copilot, github copilot, codex cli, ' +
      'amazon q developer, gemini code assist, gemini cli, tabnine, cody, ' +
      'replit agent, bolt.new, lovable, v0.dev, manus ai, devin, ' +
      'augment code, openhands, opencode, goose, zencoder, ' +
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
      'ai quantitative trading, ai stock analysis, ai trading, algorithmic trading, ' +
      'agentic trading, vibe trading, ' +
      'FinRL, Qlib, vnpy, QuantConnect, LEAN, freqtrade, backtrader, backtesting.py, zipline, ' +
      'FinBERT, FinGPT, FinLLM, sentiment analysis trading, ' +
      'LSTM stock prediction, reinforcement learning trading, LLM financial reasoning, ' +
      'alpha factor mining, formulaic alpha, portfolio optimization, risk management, backtest, ' +
      'regime-adaptive strategy, multi-modal market analysis, ' +
      'Composer, AlgosOne, TrendSpider, NexusTrade, ' +
      'DeFi AI agents, Pionex, Cryptohopper, 3Commas, ' +
      'A股量化, 量化交易, 聚寬, BigQuant, TuShare, TradeMaster, High-Flyer Quant, ' +
      'ai portfolio, quant strategy, trading bot, high frequency trading, alternative data',
  },
  {
    label: 'AI影視生成',
    labelKey: 'analysis.preset.videoGen',
    descriptionKey: 'analysis.preset.videoGen.desc',
    icon: '🎬',
    keywords:
      'ai video generation, ai animation, ai漫劇, ai短劇, ' +
      'sora, sora 2, veo 3, kling, kling 3.0, runway, runway gen-4, ' +
      'pika, luma, minimax video, hailuo, heygen, wan2.1, vidu, seedance, ' +
      'pixverse, ltx studio, domo ai, viggle, ' +
      'text to video, image to video, video to video, ' +
      'ai film, ai cinematography, ai vfx, ai dubbing, ' +
      'world model, multi-shot storyboarding, ai audio-visual generation, ' +
      'ai image generation, flux, flux 2, stable diffusion, sd webui, midjourney, ' +
      'ideogram, recraft, gpt-4o image generation, leonardo ai, magnific ai, krea ai, ' +
      'comfyui, comfyui video, comfyui workflow, comfyui cloud, ' +
      'character consistency, ip adapter, ai style transfer, ai text in image, ' +
      'consistory, animatediff, ' +
      'hunyuan video, cogvideox, mochi, ltx video, skyreels',
  },
  {
    label: 'LLM開源動態',
    labelKey: 'analysis.preset.llmOpenSource',
    descriptionKey: 'analysis.preset.llmOpenSource.desc',
    icon: '🧠',
    keywords:
      'open source llm, local llm, 開源大模型, ' +
      'deepseek, deepseek r1, deepseek v3, qwen, qwen3, llama, llama 4, ' +
      'mistral, mistral large, gemma, gemma 3, phi-4, ' +
      'glm, glm-5, chatglm, ernie 4.5, yi, ' +
      'command r+, dbrx, jamba, nemotron, internlm, 通義千問, 文心一言, ' +
      'ollama, vllm, llama.cpp, lm studio, localai, ' +
      'sglang, tensorrt-llm, exllamav2, mlc llm, groq, ' +
      'LoRA, QLoRA, unsloth, axolotl, llama-factory, torchtune, openrlhf, ' +
      'fine tuning, GGUF, GPTQ, AWQ, grpo, dpo, orpo, ' +
      'langchain, langgraph, llamaindex, crewai, semantic kernel, ' +
      'openai agents sdk, google adk, smolagents, pydantic ai, agno, dspy, mastra, ' +
      'rag, agentic rag, graphrag, lightrag, dify, firecrawl, ragas, deepeval, langfuse, ' +
      'ai story generation, ai novel writing, npc dialogue, narrative ai, ' +
      'small language model, edge ai, on device inference',
  },
  {
    label: 'AI語音克隆',
    labelKey: 'analysis.preset.voiceClone',
    descriptionKey: 'analysis.preset.voiceClone.desc',
    icon: '🎙️',
    keywords:
      'voice cloning, ai voice, 語音克隆, 語音合成, ' +
      'tts, text to speech, 中文tts, 粵語tts, 國語語音合成, zero shot tts, few shot voice cloning, ' +
      'GPT-SoVITS, CosyVoice, cosyvoice2, fish audio, fish speech, ' +
      'VITS, XTTS, Coqui TTS, PaddleSpeech, MeloTTS, ChatTTS, EmotiVoice, ' +
      'orpheus tts, kokoro tts, sesame csm, f5-tts, spark tts, dia tts, ' +
      'chatterbox tts, qwen3-tts, zonos tts, styletts2, openvoice, bark tts, mars5 tts, indextts, ' +
      'asr, speech recognition, 中文asr, whisper, funASR, ' +
      'sense voice, moonshine, nvidia canary, voxtral, ' +
      'voice conversion, speaker diarization, real time voice clone, ' +
      'elevenlabs, rvc, ai lip sync, ai dubbing voice, kimi audio',
  },
  {
    label: 'AI軟體工程',
    labelKey: 'analysis.preset.softwareEng',
    descriptionKey: 'analysis.preset.softwareEng.desc',
    icon: '🔧',
    keywords:
      'ai software engineering, ai devops, ai native development, ai first development, ' +
      'agentic sdlc, software 2.0, ' +
      'ai testing, ai test generation, visual regression testing, ai qa automation, ' +
      'self healing tests, self-healing selectors, flake detection, Katalon, mabl, testRigor, ' +
      'ai code review, automated code review, CodeRabbit, qodo, codescene, moderne, DeepSource, Graphite, ' +
      'Semgrep, Checkmarx, ai sast, ai dast, software composition analysis, AI BOM, supply chain security ai, ' +
      'ai observability, langfuse, arize ai, braintrust, ai gateway, LLM observability, ' +
      'ai ci cd, ai pull request, autonomous refactoring, technical debt ai, ai architecture, prompt engineering, ' +
      'Mintlify, ai documentation, ' +
      'swe bench, swe-bench verified, LiveCodeBench, Terminal-Bench, humaneval, mbpp, ai coding benchmark',
  },
];
