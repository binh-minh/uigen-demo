import { anthropic } from "@ai-sdk/anthropic";

const MODEL = "claude-haiku-4-5-20251001";

type V2StreamPart =
  | { type: "stream-start"; warnings: any[] }
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "tool-input-start"; id: string; toolName: string }
  | { type: "tool-input-delta"; id: string; delta: string }
  | { type: "tool-input-end"; id: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: string }
  | { type: "finish"; usage: { inputTokens: number; outputTokens: number; totalTokens: number }; finishReason: string };

export class MockLanguageModel {
  readonly specificationVersion = "v2" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls = {};

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractUserPrompt(prompt: any[]): string {
    for (let i = prompt.length - 1; i >= 0; i--) {
      const message = prompt[i];
      if (message.role === "user") {
        const content = message.content;
        if (Array.isArray(content)) {
          return content
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text)
            .join(" ");
        } else if (typeof content === "string") {
          return content;
        }
      }
    }
    return "";
  }

  private async *generateMockStream(
    prompt: any[],
    userPrompt: string
  ): AsyncGenerator<V2StreamPart> {
    const toolMessageCount = prompt.filter((m) => m.role === "tool").length;

    const promptLower = userPrompt.toLowerCase();
    let componentType = "counter";
    let componentName = "Counter";

    if (promptLower.includes("form")) {
      componentType = "form";
      componentName = "ContactForm";
    } else if (promptLower.includes("card")) {
      componentType = "card";
      componentName = "Card";
    }

    yield { type: "stream-start", warnings: [] };

    // Step 1: Create App.jsx
    if (toolMessageCount === 0) {
      const text = `This is a static response. Add an Anthropic API key in .env for real AI generation. Creating ${componentName} component.`;
      yield { type: "text-start", id: "text-0" };
      for (const char of text) {
        yield { type: "text-delta", id: "text-0", delta: char };
        await this.delay(15);
      }
      yield { type: "text-end", id: "text-0" };

      const args = JSON.stringify({
        command: "create",
        path: "/App.jsx",
        file_text: this.getAppCode(componentName),
      });
      yield { type: "tool-input-start", id: "call_3", toolName: "str_replace_editor" };
      yield { type: "tool-input-delta", id: "call_3", delta: args };
      yield { type: "tool-input-end", id: "call_3" };
      yield { type: "tool-call", toolCallId: "call_3", toolName: "str_replace_editor", input: args };
      yield { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 } };
      return;
    }

    // Step 2: Create component file
    if (toolMessageCount === 1) {
      const text = `Creating the ${componentName} component.`;
      yield { type: "text-start", id: "text-1" };
      for (const char of text) {
        yield { type: "text-delta", id: "text-1", delta: char };
        await this.delay(25);
      }
      yield { type: "text-end", id: "text-1" };

      const args = JSON.stringify({
        command: "create",
        path: `/components/${componentName}.jsx`,
        file_text: this.getComponentCode(componentType),
      });
      yield { type: "tool-input-start", id: "call_1", toolName: "str_replace_editor" };
      yield { type: "tool-input-delta", id: "call_1", delta: args };
      yield { type: "tool-input-end", id: "call_1" };
      yield { type: "tool-call", toolCallId: "call_1", toolName: "str_replace_editor", input: args };
      yield { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 } };
      return;
    }

    // Step 3+: Final summary
    if (toolMessageCount >= 2) {
      const text = `Done! Created **${componentName}.jsx** and **App.jsx**. The component is visible in the preview.`;
      yield { type: "text-start", id: "text-2" };
      for (const char of text) {
        yield { type: "text-delta", id: "text-2", delta: char };
        await this.delay(30);
      }
      yield { type: "text-end", id: "text-2" };
      yield { type: "finish", finishReason: "stop", usage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 } };
      return;
    }
  }

  private getComponentCode(componentType: string): string {
    switch (componentType) {
      case "form":
        return `import React, { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Message sent!');
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-violet-950 p-10 rounded-2xl shadow-2xl shadow-violet-900/50 max-w-md w-full">
      <h2 className="text-3xl font-black text-white mb-1 tracking-tight">Get in Touch</h2>
      <p className="text-violet-300 text-sm mb-8 font-light">We'll get back to you within 24 hours.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">Message</label>
          <textarea name="message" value={formData.message} onChange={handleChange} required rows={4}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none" />
        </div>
        <button type="submit"
          className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-xl shadow-lg shadow-violet-500/30 hover:brightness-110 active:scale-95 transition-all">
          Send Message
        </button>
      </form>
    </div>
  );
};

export default ContactForm;`;

      case "card":
        return `import React from 'react';

const Card = ({
  title = "Pro Plan",
  price = "$49",
  period = "/month",
  features = ["Unlimited projects", "Priority support", "Advanced analytics", "Custom domains"],
  cta = "Get Started"
}) => {
  return (
    <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 p-px rounded-2xl shadow-2xl shadow-indigo-500/40">
      <div className="bg-slate-950 rounded-2xl p-8">
        <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-widest rounded-full mb-6">Most Popular</span>
        <h3 className="text-2xl font-black text-white mb-1">{title}</h3>
        <div className="flex items-baseline gap-1 mb-8">
          <span className="text-5xl font-black text-white">{price}</span>
          <span className="text-slate-400 text-sm">{period}</span>
        </div>
        <ul className="space-y-3 mb-8">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-3 text-slate-300 text-sm">
              <span className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {f}
            </li>
          ))}
        </ul>
        <button className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:brightness-110 active:scale-95 transition-all">
          {cta}
        </button>
      </div>
    </div>
  );
};

export default Card;`;

      default:
        return `import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="bg-slate-950 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-8 shadow-2xl">
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Counter</h2>
      <div className="text-8xl font-black text-white tabular-nums">{count}</div>
      <div className="flex gap-3">
        <button onClick={() => setCount(c => c - 1)}
          className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 font-bold text-xl hover:bg-rose-500/20 active:scale-95 transition-all border border-rose-500/20">
          −
        </button>
        <button onClick={() => setCount(0)}
          className="w-12 h-12 rounded-xl bg-white/5 text-slate-400 font-bold text-sm hover:bg-white/10 active:scale-95 transition-all border border-white/10">
          ↺
        </button>
        <button onClick={() => setCount(c => c + 1)}
          className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-xl hover:bg-emerald-500/20 active:scale-95 transition-all border border-emerald-500/20">
          +
        </button>
      </div>
    </div>
  );
};

export default Counter;`;
    }
  }

  private getAppCode(componentName: string): string {
    const importPath = `@/components/${componentName}`;
    if (componentName === "Card") {
      return `import Card from '${importPath}';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <Card />
      </div>
    </div>
  );
}`;
    }
    return `import ${componentName} from '${importPath}';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <${componentName} />
    </div>
  );
}`;
  }

  async doGenerate(options: any): Promise<any> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const parts: V2StreamPart[] = [];
    for await (const part of this.generateMockStream(options.prompt, userPrompt)) {
      parts.push(part);
    }

    const textParts = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p as any).delta)
      .join("");

    const toolCalls = parts
      .filter((p) => p.type === "tool-call")
      .map((p) => ({
        type: "tool-call" as const,
        toolCallId: (p as any).toolCallId,
        toolName: (p as any).toolName,
        input: (p as any).input,
      }));

    const finishPart = parts.find((p) => p.type === "finish") as any;

    return {
      content: [
        ...(textParts ? [{ type: "text" as const, text: textParts }] : []),
        ...toolCalls,
      ],
      finishReason: finishPart?.finishReason ?? "stop",
      usage: finishPart?.usage ?? { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      warnings: [],
    };
  }

  async doStream(options: any): Promise<any> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const self = this;

    const stream = new ReadableStream<V2StreamPart>({
      async start(controller) {
        try {
          for await (const chunk of self.generateMockStream(options.prompt, userPrompt)) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return { stream, warnings: [], request: {} };
  }
}

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.log("No ANTHROPIC_API_KEY found, using mock provider");
    return new MockLanguageModel("mock-claude-sonnet-4-0") as any;
  }

  return anthropic(MODEL);
}
