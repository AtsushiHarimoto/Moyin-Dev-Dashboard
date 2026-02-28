import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { getCodeString } from 'rehype-rewrite';
import mermaid from 'mermaid';
import clsx from 'clsx';

// Initialize Mermaid with the correct theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
  fontFamily: 'Inter, sans-serif',
});

// Mermaid Lightbox with zoom & pan
const MermaidLightbox = ({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    setScale(prev => Math.min(5, Math.max(0.5, prev + (e.deltaY < 0 ? 0.15 : -0.15))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
    e.preventDefault();
  }, [pos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPos({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-[96vw] h-[96vh] overflow-hidden bg-[var(--color-twilight-purple)] rounded-2xl border border-white/10 shadow-2xl select-none"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        >
          <span className="material-icons text-xl">close</span>
        </button>

        {/* Zoom indicator */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-moonlight/10 text-xs text-[var(--color-moonlight)] z-10 font-mono">
          {Math.round(scale * 100)}%
        </div>

        {/* SVG container */}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: isDragging.current ? 'none' : 'transform 0.15s ease-out' }}
        >
          <img src={imageUrl} alt="Mermaid diagram" className="max-w-none max-h-none select-none pointer-events-none" draggable={false} />
        </div>
      </motion.div>
    </motion.div>
  );
};

// Mermaid-aware Code component (follows official @uiw/react-markdown-preview pattern)
const randomid = () => parseInt(String(Math.random() * 1e15), 10).toString(36);

function svgToObjectUrl(svg: string): string {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}

const MermaidCode = ({ children = [], className, ...props }: any) => {
  const demoid = useRef(`mermaid-${randomid()}`);
  const [svgImageUrl, setSvgImageUrl] = useState('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const isMermaid = className && /^language-mermaid/.test(className.toLocaleLowerCase());
  const code = props.node && props.node.children ? getCodeString(props.node.children) : (children[0] || '');

  useEffect(() => {
    if (!isMermaid) return;

    let cancelled = false;

    mermaid.render(demoid.current, String(code))
      .then((result) => {
        if (cancelled) return;
        const nextUrl = svgToObjectUrl(result.svg);
        setSvgImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
        setRenderError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setRenderError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [isMermaid, code]);

  useEffect(() => {
    return () => {
      if (svgImageUrl) {
        URL.revokeObjectURL(svgImageUrl);
      }
    };
  }, [svgImageUrl]);

  const openLightbox = useCallback(() => {
    if (svgImageUrl) setIsLightboxOpen(true);
  }, [svgImageUrl]);

  const handleLightboxKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && svgImageUrl) {
      e.preventDefault();
      setIsLightboxOpen(true);
    }
  }, []);

  if (isMermaid) {
    return (
      <>
        <div
          className="mermaid-diagram my-6 p-4 bg-white/5 rounded-xl border border-white/10 overflow-x-auto flex justify-center relative group cursor-pointer"
          role="button"
          tabIndex={0}
          title="Click to enlarge"
          onClick={openLightbox}
          onKeyDown={handleLightboxKeyDown}
        >
          {svgImageUrl ? (
            <img src={svgImageUrl} alt="Mermaid diagram" className="max-w-full h-auto" draggable={false} />
          ) : renderError ? (
            <span className="text-red-400 text-sm">Mermaid Error: {renderError}</span>
          ) : (
            <span className="text-[var(--color-morning-mist)] text-sm">Rendering diagram...</span>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-xl flex items-center justify-center pointer-events-none">
            <span className="material-icons text-3xl text-white opacity-0 group-hover:opacity-80 transition-opacity">zoom_in</span>
          </div>
        </div>
        <AnimatePresence>
          {isLightboxOpen && svgImageUrl && <MermaidLightbox imageUrl={svgImageUrl} onClose={() => setIsLightboxOpen(false)} />}
        </AnimatePresence>
      </>
    );
  }

  return <code className={className} {...props}>{children}</code>;
};

// Shared slug generation — must match between parseTocHeadings and rendered heading IDs
function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
}

// Helper: extract plain text from React children (for heading components)
function childrenToText(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(childrenToText).join('');
  if (children?.props?.children) return childrenToText(children.props.children);
  return '';
}

// Heading components that inject matching `id` for TOC anchor links
function makeHeading(Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return function HeadingComponent({ children, ...props }: any) {
    const text = childrenToText(children);
    const id = toSlug(text);
    return <Tag id={id} className="scroll-mt-32" {...props}>{children}</Tag>;
  };
}

const headingComponents = {
  h1: makeHeading('h1'),
  h2: makeHeading('h2'),
  h3: makeHeading('h3'),
  h4: makeHeading('h4'),
  h5: makeHeading('h5'),
  h6: makeHeading('h6'),
};

// Collapsible Section Component
const WikiSection = ({ id, title, content, defaultOpen = true }: { id?: string, title: string, content: string, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-16">
        {title && (
            <div
                id={id}
                onClick={() => setIsOpen(!isOpen)}
                className="group flex items-center cursor-pointer py-2 mb-4 border-b border-white/10 hover:border-primary/50 transition-colors select-none scroll-mt-32"
            >
                <div className={clsx(
                    "mr-3 p-1 rounded-full transition-all duration-300",
                    isOpen ? "bg-primary/20 text-primary rotate-0" : "bg-moonlight/5 text-[var(--color-morning-mist)] -rotate-90"
                )}>
                    <span className="material-icons text-lg block">expand_more</span>
                </div>
                <h2 className="text-2xl font-bold text-[var(--color-moonlight)] group-hover:text-primary transition-colors flex-1">
                    {title}
                </h2>
            </div>
        )}

        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                >
                   <MarkdownPreview
                     source={content}
                     wrapperElement={{ "data-color-mode": "dark" } as any}
                     style={{ background: 'transparent', padding: 0 }}
                     components={{ code: MermaidCode, ...headingComponents }}
                   />
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

// TOC heading type
interface TocHeading { id: string; title: string; level: number; }

// Section type for H2-based content splitting
interface Section { id: string; title: string; content: string; }

// Pure function to parse TOC headings (H1–H6) from markdown
function parseTocHeadings(markdownContent: string): TocHeading[] {
  if (!markdownContent) return [];
  const lines = markdownContent.split(/\r?\n/);
  const headings: TocHeading[] = [];
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      if (!title) continue;
      headings.push({ id: toSlug(title), title, level });
    }
  }
  return headings;
}

// Pure function to split markdown into collapsible sections by H2
function parseSections(markdownContent: string): Section[] {
  if (!markdownContent) return [];
  const lines = markdownContent.split(/\r?\n/);
  const sections: Section[] = [];
  let currentTitle = '';
  let currentBuffer: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) { inCodeBlock = !inCodeBlock; }

    if (!inCodeBlock) {
      const h2Match = line.match(/^##\s+(.+)$/);
      if (h2Match) {
        if (currentBuffer.length > 0 || currentTitle) {
          sections.push({ id: toSlug(currentTitle), title: currentTitle, content: currentBuffer.join('\n') });
        }
        currentTitle = h2Match[1].trim();
        currentBuffer = [];
        continue;
      }
    }

    currentBuffer.push(line);
  }

  if (currentBuffer.length > 0 || currentTitle) {
    sections.push({ id: toSlug(currentTitle), title: currentTitle, content: currentBuffer.join('\n') });
  }

  return sections;
}

export { MermaidCode, WikiSection, toSlug, parseTocHeadings, parseSections };
export type { TocHeading, Section };
