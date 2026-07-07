import React from "react";
import CopyBtn from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// Recognizes YouTube/Vimeo links so they render as an embedded, playable
// player instead of a plain link when they're the sole content of a line.
function getVideoEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const videoId =
      parsed.searchParams.get("v") ??
      parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  if (host === "youtu.be") {
    const videoId = parsed.pathname.slice(1);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  if (host === "vimeo.com") {
    const videoId = parsed.pathname.match(/^\/(\d+)/)?.[1];
    return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
  }
  if (host === "player.vimeo.com") {
    return parsed.pathname.startsWith("/video/") ? url : null;
  }
  return null;
}

function VideoEmbed({ embedUrl }: { embedUrl: string }) {
  return (
    <span className="relative my-2 block aspect-video max-w-2xl">
      <iframe
        src={embedUrl}
        className="absolute inset-0 size-full rounded-md border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </span>
  );
}

function PreWithCopyBtn({ className, ...props }: React.ComponentProps<"pre">) {
  const ref = React.useRef<HTMLPreElement>(null);
  return (
    <span className="group relative">
      <CopyBtn
        className="absolute right-1 top-1 m-1 hidden text-white group-hover:block"
        getStringToCopy={() => {
          return ref.current?.textContent ?? "";
        }}
      />
      <pre ref={ref} className={cn(className, "")} {...props} />
    </span>
  );
}

export function MarkdownReadonly({
  children: markdown,
  className,
  onSave,
}: {
  children: string;
  className?: string;
  onSave?: (markdown: string) => void;
}) {
  /**
   * This method is triggered when a checkbox is toggled from the masonry view
   * It finds the index of the clicked checkbox inside of the note
   * It then finds the corresponding markdown and changes it accordingly
   */
  const handleTodoClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const parent = e.target.closest(".prose");
    if (!parent) return;
    const allCheckboxes = parent.querySelectorAll(".todo-checkbox");
    let checkboxIndex = 0;
    allCheckboxes.forEach((cb, i) => {
      if (cb === e.target) checkboxIndex = i;
    });
    let i = 0;
    const todoPattern = /^(\s*[-*+]\s*\[)( |x|X)(\])/gm;
    const newMarkdown = markdown.replace(
      todoPattern,
      (match, prefix: string, state: string, suffix: string) => {
        const currentIndex = i++;
        if (currentIndex !== checkboxIndex) {
          return match;
        }
        const isDone = state.toLowerCase() === "x";
        const nextState = isDone ? " " : "x";
        return `${prefix}${nextState}${suffix}`;
      },
    );
    if (onSave) {
      onSave(newMarkdown);
    }
  };

  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      className={cn("prose dark:prose-invert", className)}
      components={{
        input: (props) =>
          props.type === "checkbox" ? (
            <input
              checked={props.checked}
              onChange={handleTodoClick}
              type="checkbox"
              className="todo-checkbox"
            />
          ) : (
            <input {...props} readOnly />
          ),
        pre({ ...props }) {
          return <PreWithCopyBtn {...props} />;
        },
        a({ href, children, ...props }) {
          const embedUrl = href ? getVideoEmbedUrl(href) : null;
          if (embedUrl) {
            return <VideoEmbed embedUrl={embedUrl} />;
          }
          return (
            <a href={href} {...props}>
              {children}
            </a>
          );
        },
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? "");
          return match ? (
            <SyntaxHighlighter
              PreTag="div"
              language={match[1]}
              {...props}
              style={dracula}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {markdown}
    </Markdown>
  );
}
