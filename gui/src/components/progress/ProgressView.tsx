import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { progressApi } from '../../utils/api';
import { useI18n } from '../../i18n';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { MermaidCode, parseTocHeadings, toSlug } from '../wiki/MarkdownRenderer';

// Heading components that inject matching `id` for TOC anchor links
function childrenToText(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(childrenToText).join('');
  if (children?.props?.children) return childrenToText(children.props.children);
  return '';
}

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

export function ProgressView() {
  const { t } = useI18n();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['progress'],
    queryFn: () => progressApi.getContent(),
  });

  const tocHeadings = React.useMemo(
    () => (data?.content ? parseTocHeadings(data.content) : []),
    [data?.content]
  );

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-morning-mist">
          <span className="material-icons animate-spin">progress_activity</span>
          <span>{t('progress.loading')}</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-morning-mist">
          <span className="material-icons text-4xl mb-2 block">error_outline</span>
          <p>{t('progress.error')}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
          >
            {t('progress.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 scrollbar-sakura scroll-smooth">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-icons text-primary text-3xl">trending_up</span>
            <h1 className="text-2xl font-bold text-[var(--color-moonlight)]">{t('progress.title')}</h1>
          </div>
          <p className="text-morning-mist text-sm">{t('progress.subtitle')}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-morning-mist/60">
            <span>{t('progress.updatedAt')}: {new Date(data.updatedAt).toLocaleString()}</span>
            <span>{(data.size / 1024).toFixed(1)} KB</span>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1 px-2 py-1 rounded bg-moonlight/5 hover:bg-moonlight/10 transition-colors"
              title={t('progress.refresh')}
            >
              <span className="material-icons text-sm">refresh</span>
              {t('progress.refresh')}
            </button>
          </div>
        </div>

        {/* Markdown Content */}
        <div className="prose-container">
          <MarkdownPreview
            source={data.content}
            wrapperElement={{ "data-color-mode": "dark" } as any}
            style={{ background: 'transparent', padding: 0 }}
            components={{ code: MermaidCode, ...headingComponents }}
          />
        </div>
      </div>

      {/* TOC Sidebar */}
      {tocHeadings.length > 0 && (
        <aside className="w-56 shrink-0 border-l border-white/10 p-4 overflow-y-auto hidden xl:block scrollbar-wiki">
          <h3 className="text-xs font-semibold text-morning-mist/60 uppercase tracking-wider mb-3">
            {t('progress.onThisPage')}
          </h3>
          <nav className="space-y-1">
            {tocHeadings.map((heading, idx) => (
              <button
                key={`${heading.id}-${idx}`}
                onClick={() => scrollToHeading(heading.id)}
                className="block w-full text-left text-sm text-morning-mist/80 hover:text-primary transition-colors truncate"
                style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
                title={heading.title}
              >
                {heading.title}
              </button>
            ))}
          </nav>
        </aside>
      )}
    </div>
  );
}
