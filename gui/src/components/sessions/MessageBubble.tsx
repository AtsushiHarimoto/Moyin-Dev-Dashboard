/**
 * MessageBubble 組件
 * 採用高端極簡設計
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Message } from '../../types';
import { useI18n } from '../../i18n';

interface MessageBubbleProps {
  message: Message;
}

const markdownComponents: Components = {
  code(props) {
    const { children, className } = props;
    const match = /language-(\w+)/.exec(className || '');
    const isTool = String(children).startsWith('TOOL:');

    if (isTool) {
      const toolName = String(children).replace('TOOL:', '');
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-moonlight/5 border border-moonlight/10 text-[10px] font-bold text-primary tracking-widest uppercase my-1 select-none">
          <span className="material-icons text-[14px]">build</span>
          {toolName}
        </span>
      );
    }

    return match ? (
      <SyntaxHighlighter
        PreTag="div"
        language={match[1]}
        style={oneDark}
        customStyle={{ margin: '1.5em 0', borderRadius: '16px', fontSize: '0.85em', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem' }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={`${className || ''} bg-moonlight/10 px-1.5 py-0.5 rounded text-primary font-mono text-xs font-bold`}>
        {children}
      </code>
    );
  },
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const { locale, t } = useI18n();
  const isUser = message.role === 'user';
  const content = message.content || t('message.noContent');

  const thinkingRegex = /<antThinking>([\s\S]*?)<\/antThinking>/;
  const thinkingMatch = content.match(thinkingRegex);
  const thinkingContent = thinkingMatch ? thinkingMatch[1] : null;
  const displayWithThinking = thinkingContent ? content.replace(thinkingRegex, '').trim() : content;

  // Detect [Tool: xxx] patterns
  const toolRegex = /\[Tool:\s*([^\]]+)\]/g;
  const displayContent = displayWithThinking.replace(toolRegex, (_match, toolName) => {
    return `\`TOOL:${toolName}\``; // Temporarily map to code for markdown to pick up, or use a custom component
  });

  const normalizedContent = displayContent.trim();

  const [showThinking, setShowThinking] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'relative mb-10 w-full flex flex-col',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      {/* Header Info */}
      <div className={clsx(
        'flex items-center gap-3 mb-2.5 px-1 text-[10px] font-bold uppercase tracking-[0.2em]',
        isUser ? 'flex-row-reverse text-primary' : 'flex-row text-[var(--color-morning-mist)]'
      )}>
        <span className="text-glow">{isUser ? t('message.user') : t('message.assistant')}</span>
        <span className="w-1 h-1 rounded-full bg-[var(--color-smoke-purple)]"></span>
        <span className="text-[9px] font-bold opacity-30 lowercase tracking-normal font-mono">
          {new Date(message.timestamp).toLocaleString(locale, { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Bubble Container */}
      <div className={clsx(
        'relative max-w-[85%] lg:max-w-[75%] rounded-[24px] overflow-hidden transition-all duration-500 group',
        isUser
          ? 'bg-primary/10 border border-primary/20 rounded-tr-none shadow-[0_4px_20px_var(--color-sakura-glow)]'
          : 'bg-moonlight/[0.03] border border-moonlight/10 rounded-tl-none shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
      )}>
        {/* Thinking Section */}
        {thinkingContent && (
          <div className="border-b border-moonlight/5 bg-[var(--color-dark-purple)]/20">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="w-full px-5 py-3 text-[10px] font-bold tracking-widest uppercase flex items-center justify-between group/think text-[var(--color-morning-mist)] hover:text-primary transition-all focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="material-icons text-sm">{showThinking ? 'psychology_alt' : 'psychology'}</span>
                {t('message.thinking')}
              </div>
              <span className={clsx("material-icons text-sm transition-transform duration-300", showThinking && "rotate-180")}>expand_more</span>
            </button>

            <AnimatePresence>
              {showThinking && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-1 text-[11px] font-mono text-[var(--color-morning-mist)] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto scrollbar-none italic bg-[var(--color-dark-purple)]/10">
                    <span className="inline-block border-l-2 border-primary/30 pl-4 py-1">
                      {thinkingContent.trim()}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Message Content */}
        <div className="p-6">
          <div className={clsx(
            "prose prose-invert prose-sm max-w-none break-words leading-relaxed selection:bg-primary/30",
            "prose-p:text-[var(--color-moonlight)] prose-p:leading-relaxed prose-p:mb-4 last:prose-p:mb-0",
            "prose-headings:text-[var(--color-moonlight)] prose-headings:font-bold prose-headings:tracking-tight",
            "prose-strong:text-[var(--color-moonlight)] prose-strong:font-bold",
            "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
            "prose-ul:list-disc prose-ol:list-decimal prose-li:text-[var(--color-moonlight)]",
            "prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none",
            "prose-blockquote:border-l-primary/40 prose-blockquote:bg-moonlight/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-xl"
          )}>
            <ReactMarkdown components={markdownComponents}>
              {normalizedContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* Glow Effect for Active Message */}
        <div className={clsx(
          "absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700",
          isUser
            ? "bg-gradient-to-br from-primary/5 via-transparent to-transparent"
            : "bg-gradient-to-br from-moonlight/5 via-transparent to-transparent"
        )}></div>
      </div>
    </motion.div>
  );
}
