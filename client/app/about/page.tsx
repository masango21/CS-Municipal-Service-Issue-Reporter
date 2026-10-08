import { InformationPage } from "@/components/InformationPage";

export default function AboutPage() {
  return (
    <InformationPage
      title="About"
      intro="Municipal Service Issue Reporter is an Information Technology project for recording map-located municipal service issues and helping municipal staff review and triage them."
    >
      <section className="py-8" aria-labelledby="about-purpose">
        <h2 id="about-purpose" className="text-xl font-bold text-slate-900">Purpose</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">The project brings resident-submitted issue descriptions and their locations into a shared reporting workflow. It is intended to make it easier to submit an issue and follow the report status in one place. It does not promise a municipal response time or confirm that a particular municipality operates this instance.</p>
      </section>

      <section className="py-8" aria-labelledby="about-users">
        <h2 id="about-users" className="text-xl font-bold text-slate-900">Who it serves</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Residents can submit reports, view their own reports, and browse the public issue map and feed. Municipal staff can review and triage reports within their authorized municipality. Super-admin tools manage staff and municipality access.</p>
      </section>

      <section className="py-8" aria-labelledby="about-features">
        <h2 id="about-features" className="text-xl font-bold text-slate-900">What the application includes</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600 marker:text-emerald-700">
          <li>Resident accounts and authenticated issue submission.</li>
          <li>Issue categories, priorities, descriptions, exact map locations, and optional evidence images.</li>
          <li>A public South Africa-focused map and searchable, filterable issue feed.</li>
          <li>Resident report dashboards and municipal status updates.</li>
          <li>Municipal staff workflows for report triage and access management.</li>
        </ul>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">Reports and map pins are created from real submissions; the application does not include preloaded demonstration reports.</p>
      </section>

      <section className="py-8" aria-labelledby="about-technology">
        <h2 id="about-technology" className="text-xl font-bold text-slate-900">Project information</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">The client uses Next.js, React, TypeScript, and Tailwind CSS. The API uses Express. PostgreSQL is required for production; a JSON file store is limited to local development and isolated tests. Maps use Leaflet with OpenStreetMap services.</p>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">No company, sponsoring organization, named developer, or version is identified in the project information. The repository describes the application as not live and not ready for unrestricted public registration.</p>
      </section>
    </InformationPage>
  );
}