import Link from "next/link";
import { InformationPage } from "@/components/InformationPage";

const sectionClass = "py-8";
const headingClass = "text-xl font-bold text-slate-900";
const paragraphClass = "mt-3 max-w-3xl text-sm leading-6 text-slate-600";

export default function PrivacyPage() {
  return (
    <InformationPage
      title="Privacy Policy"
      intro="This draft describes information handled by the current Municipal Service Issue Reporter implementation. Replace the bracketed details and have the policy reviewed before public use. Effective date: [EFFECTIVE DATE]."
    >
      <section className={sectionClass} aria-labelledby="privacy-introduction">
        <h2 id="privacy-introduction" className={headingClass}>1. Introduction</h2>
        <p className={paragraphClass}>The application supports resident submissions of municipal service issues and staff review of those reports. This project does not identify a legal operator or confirm that a production service is live. Privacy contact: [PRIVACY CONTACT / SUPPORT EMAIL].</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-collection">
        <h2 id="privacy-collection" className={headingClass}>2. Information We Collect</h2>
        <p className={paragraphClass}>Resident account records include a name and email address, an optional phone number, and a password hash. Staff account records include a name, email address, role, active status, and password hash. Passwords are processed for authentication and stored as salted scrypt hashes; the application does not provide email verification.</p>
        <p className={paragraphClass}>A report can include its title, description, category, priority, status, city or municipality, map coordinates, timestamps, and an optional JPEG, PNG, or WebP evidence image of up to 3 MB. The server also processes staff assignments, private staff notes, public status updates, municipality access, and audit records to operate the staff workflow.</p>
        <p className={paragraphClass}>When you search for a place on the map, the search text is sent to OpenStreetMap&apos;s Nominatim service. Map use sends tile requests to OpenStreetMap. If you choose device location and grant browser permission, the browser supplies coordinates; selected report coordinates are sent to the application for location and municipality resolution.</p>
        <p className={paragraphClass}>The API applies request rate limits, which use request information to count attempts. The project does not specify whether hosting providers retain IP addresses, device/browser details, or operational logs, or for how long: [HOSTING / LOG RETENTION DETAILS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-use">
        <h2 id="privacy-use" className={headingClass}>3. How We Use Information</h2>
        <p className={paragraphClass}>Information is used to create and authenticate accounts, accept and display reports, show residents their own reports, resolve report locations, and let authorized municipal staff review and triage issues. Public report views omit reporter identity and staff-only notes and assignment fields. Public reports may include their submitted details, location, evidence image, and staff-posted updates; an update may display the staff author&apos;s name.</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-storage">
        <h2 id="privacy-storage" className={headingClass}>4. How We Store Information</h2>
        <p className={paragraphClass}>Production is designed to use PostgreSQL. Local development and isolated tests may use a JSON file store. In the current database implementation, evidence images are stored with report data rather than in a separate file-storage service. The project documentation identifies durable image storage as a future launch requirement.</p>
        <p className={paragraphClass}>The system does not define a retention schedule or user-facing deletion process. Replace this statement with the approved policy before launch: [DATA RETENTION PERIOD / DELETION PROCESS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-security">
        <h2 id="privacy-security" className={headingClass}>5. Data Security</h2>
        <p className={paragraphClass}>The server stores password hashes rather than plaintext passwords and uses signed session cookies marked HttpOnly. Authentication and report access are controlled by account role; staff report access is scoped to authorized municipalities. These measures do not guarantee that information is completely secure. Do not include passwords or unnecessary sensitive information in a report or image.</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-cookies">
        <h2 id="privacy-cookies" className={headingClass}>6. Cookies and Similar Technologies</h2>
        <p className={paragraphClass}>The application uses an HttpOnly session cookie named <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-800">msr_session</code> for authentication. It has a one-hour maximum age; its SameSite setting is configurable and defaults to Lax, and it is marked Secure in production. The application also uses browser local storage to remember the selected interface language. It does not store reports or authentication credentials in local storage. No analytics or advertising cookies are configured by the application.</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-third-parties">
        <h2 id="privacy-third-parties" className={headingClass}>7. Third-Party Services</h2>
        <p className={paragraphClass}>Maps use Leaflet and OpenStreetMap map tiles. Place search and default geocoding use OpenStreetMap Nominatim. Municipality boundary resolution uses Municipal Demarcation Board data. Those services are operated outside this application; their own terms and privacy practices apply. This project does not establish their data-retention practices. Review provider terms and usage limits before public deployment.</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-sharing">
        <h2 id="privacy-sharing" className={headingClass}>8. Information Sharing</h2>
        <p className={paragraphClass}>Report information is available through the public map and feed, but public responses omit resident identity and staff-only data. Authorized municipal staff can access reports within their assigned scope, and super-admins have staff and municipality management functions. The application does not implement email messaging, payment processing, analytics, or a contact form.</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-retention">
        <h2 id="privacy-retention" className={headingClass}>9. Data Retention</h2>
        <p className={paragraphClass}>No production retention period, backup schedule, or deletion process is documented in the project. The responsible operator must set and publish these details before launch: [DATA RETENTION PERIOD / DELETION PROCESS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-rights">
        <h2 id="privacy-rights" className={headingClass}>10. User Rights and Requests</h2>
        <p className={paragraphClass}>The application does not include self-service profile editing, account deletion, or resident report editing and deletion. The operator&apos;s process for access, correction, or deletion requests and any applicable legal rights have not been established in the project. Contact [PRIVACY CONTACT / SUPPORT EMAIL] after that channel is verified; request process: [DATA ACCESS / CORRECTION / DELETION PROCESS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-children">
        <h2 id="privacy-children" className={headingClass}>11. Children&apos;s Privacy</h2>
        <p className={paragraphClass}>The project does not define an age requirement or child-specific privacy process. The responsible operator must determine and publish the applicable requirements before launch: [CHILDREN&apos;S PRIVACY REQUIREMENTS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-changes">
        <h2 id="privacy-changes" className={headingClass}>12. Changes to This Policy</h2>
        <p className={paragraphClass}>The policy may need to change as the application and its providers change. The responsible operator and method for notifying users have not been identified: [POLICY OWNER / CHANGE NOTICE PROCESS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="privacy-contact">
        <h2 id="privacy-contact" className={headingClass}>13. Contact Information</h2>
        <p className={paragraphClass}>For privacy questions, contact [PRIVACY CONTACT / SUPPORT EMAIL]. No verified contact channel is currently configured. See the <Link href="/contact" className="font-medium text-emerald-700 underline underline-offset-2">Contact page</Link> for the details that must be completed.</p>
      </section>
    </InformationPage>
  );
}