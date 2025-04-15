import Head from "next/head";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Head>
        <title>Advanced Web Builder</title>
        <meta
          name="description"
          content="Build stunning websites with our Advanced Web Builder."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col">
        {/* Header */}
        <header className="bg-[var(--bg-toolbar)] p-4 shadow-md">
          <div className="container mx-auto">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Advanced Web Builder
            </h1>
          </div>
        </header>
        {/* Main Content */}
        <main className="flex-grow container mx-auto p-8">
          {/* Hero Section */}
          <section className="text-center my-16">
            <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
              Build Websites Effortlessly
            </h2>
            <p className="text-lg text-[var(--text-secondary)]">
              Create stunning, responsive websites in minutes with our
              innovative drag &amp; drop interface.
            </p>
          </section>
          {/* Features Section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[var(--bg-surface)] p-6 rounded-lg shadow-md hover:bg-[var(--bg-hover)] transition-colors">
              <h3 className="text-2xl font-semibold mb-3 text-[var(--text-primary)]">
                Drag &amp; Drop
              </h3>
              <p className="text-[var(--text-secondary)]">
                Easily add and arrange elements with an intuitive drag &amp;
                drop interface.
              </p>
            </div>
            <div className="bg-[var(--bg-surface)] p-6 rounded-lg shadow-md hover:bg-[var(--bg-hover)] transition-colors">
              <h3 className="text-2xl font-semibold mb-3 text-[var(--text-primary)]">
                Responsive Design
              </h3>
              <p className="text-[var(--text-secondary)]">
                Automatically adapt your website to all screen sizes—from
                desktops to mobiles.
              </p>
            </div>
            <div className="bg-[var(--bg-surface)] p-6 rounded-lg shadow-md hover:bg-[var(--bg-hover)] transition-colors">
              <h3 className="text-2xl font-semibold mb-3 text-[var(--text-primary)]">
                Customizable
              </h3>
              <p className="text-[var(--text-secondary)]">
                Personalize your design with our powerful customization tools.
              </p>
            </div>
          </section>
        </main>
        {/* Footer with "Go to builder" Button */}
        <footer className="bg-[var(--bg-panel)] p-4">
          <div className="container mx-auto text-center">
            <Link legacyBehavior href="/builder">
              <a className="inline-block px-6 py-3 bg-[var(--button-primary-bg)] text-white font-semibold rounded-md hover:bg-[var(--button-primary-hover)] transition-colors">
                Go to builder
              </a>
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}
