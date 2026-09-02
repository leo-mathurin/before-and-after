import { AutoPlayHero } from "@/components/hero";
import { Code } from "@/components/code";
import { Logo } from "@/components/logo";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#F3F3F3] text-neutral-500">
      <main className="py-10 sm:py-16">
        <div className="max-w-[540px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <a
              href="/before-and-after"
              className="text-neutral-800 hover:text-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 rounded-sm"
            >
              <h1>
                <Logo />
              </h1>
            </a>
            <nav className="flex items-center gap-2.5 sm:gap-4 text-[13px] sm:text-sm">
              <a href="#install" className="text-neutral-500 hover:text-neutral-800 transition-colors">
                Install
              </a>
              <a href="#workflow" className="text-neutral-500 hover:text-neutral-800 transition-colors">
                Workflow
              </a>
              <a
                href="https://github.com/vercel-labs/before-and-after"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-neutral-500 hover:text-neutral-800 transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5"
                  aria-hidden="true"
                >
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
              </a>
            </nav>
          </div>
          <p className="mb-8 sm:mb-12 text-[14px] sm:text-[15px]">
            An agent skill that attaches screenshots and screen recordings to pull request descriptions.
          </p>
        </div>

        <div className="mb-10 sm:mb-16 px-8 sm:px-0">
          <AutoPlayHero />
        </div>

        <div className="max-w-[540px] mx-auto px-4 sm:px-6 space-y-8 sm:space-y-10">
          <section id="install" className="scroll-mt-8 space-y-3">
            <h2 className="text-neutral-800">Install</h2>
            <p className="text-sm">Add the skill to your agent environment.</p>
            <Code>npx skills add vercel-labs/before-and-after</Code>
          </section>

          <hr className="border-neutral-100" />

          <section className="space-y-3">
            <h2 className="text-neutral-800">Skill First</h2>
            <p className="text-sm">
              Browser navigation, authentication, screenshots, and recordings stay with the version-matched
              skills bundled in <code className="text-neutral-800 bg-neutral-50 px-1 py-0.5 rounded">agent-browser</code>.
              Before and after only formats existing local media and publishes it through{" "}
              <code className="text-neutral-800 bg-neutral-50 px-1 py-0.5 rounded">gh --attach</code>.
            </p>
          </section>

          <hr className="border-neutral-100" />

          <section id="workflow" className="scroll-mt-8 space-y-6">
            <h2 className="text-neutral-800">Workflow</h2>

            <div className="space-y-2">
              <p className="text-sm">Capture media with agent-browser.</p>
              <Code>agent-browser screenshot captures/after.png</Code>
            </div>

            <div className="space-y-2">
              <p className="text-sm">Format a before and after pair.</p>
              <Code>node skill/scripts/format.mjs --before captures/before.png --after captures/after.png</Code>
            </div>

            <div className="space-y-2">
              <p className="text-sm">Use after-only media for a net-new preview.</p>
              <Code>node skill/scripts/format.mjs --after captures/new-page.png</Code>
            </div>

            <div className="space-y-2">
              <p className="text-sm">Publish with GitHub-hosted attachments.</p>
              <Code>gh pr edit 13 --body-file body.md --attach ./captures/after.png</Code>
              <p className="text-sm mt-3">
                GitHub uploads the media to its own CDN and rewrites matching local references in the PR body.
              </p>
            </div>
          </section>
        </div>

        <footer className="max-w-[540px] mx-auto px-4 sm:px-6 mt-10 sm:mt-16 pt-6 sm:pt-8 border-t border-neutral-100">
          <p className="text-sm text-neutral-500 flex flex-col items-center gap-2 sm:flex-row sm:justify-between w-full">
            <span className="inline-flex items-center gap-1.5">
              Made by{" "}
              <a
                href="https://x.com/jamesvclements"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-800 hover:underline inline-flex items-center gap-1"
              >
                <img
                  src="https://avatars.githubusercontent.com/u/20052710?v=4"
                  alt=""
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 rounded-full"
                />
                James Clements
              </a>
            </span>
            <span>
              Uses{" "}
              <a
                href="https://agentbrowser.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-800 hover:underline"
              >
                agent-browser <span className="text-[9px] relative -top-px">▲</span>
              </a>
            </span>
          </p>
        </footer>
      </main>
    </div>
  );
}
