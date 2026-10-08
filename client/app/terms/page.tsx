import Link from "next/link";
import { InformationPage } from "@/components/InformationPage";

const sectionClass = "py-8";
const headingClass = "text-xl font-bold text-slate-900";
const paragraphClass = "mt-3 max-w-3xl text-sm leading-6 text-slate-600";

export default function TermsPage() {
  return (
    <InformationPage
      title="Terms of Use"
      intro="Draft for review before public use. The operator, legal terms, effective date, and governing jurisdiction have not been identified. Effective date: [EFFECTIVE DATE]."
    >
      <section className="border-y border-amber-200 bg-amber-50 py-4" aria-label="Draft notice">
        <p className="text-sm leading-6 text-amber-950">This page contains unresolved placeholders and is not a finalized legal agreement. Replace them and obtain appropriate review before relying on these terms.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-acceptance">
        <h2 id="terms-acceptance" className={headingClass}>1. Acceptance of Terms</h2>
        <p className={paragraphClass}>These draft terms are intended to describe use of Municipal Service Issue Reporter. The operator and process for presenting and accepting final terms must be confirmed: [COMPANY NAME] and [TERMS ACCEPTANCE PROCESS]. If final terms are published, review them before using the service.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-service">
        <h2 id="terms-service" className={headingClass}>2. Description of the Service</h2>
        <p className={paragraphClass}>The application supports resident-submitted municipal issue reports with map locations and staff workflows for reviewing and triaging those reports. It is a project and is not confirmed as a live official municipal service. It does not guarantee that a municipality receives or resolves a report, or specify a response time.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-accounts">
        <h2 id="terms-accounts" className={headingClass}>3. User Accounts</h2>
        <p className={paragraphClass}>Residents register with a name, email address, and password; a phone number is optional. Staff access follows a separate invitation-controlled process. Users should provide accurate account details, keep their sign-in credentials private, and sign out on shared devices. Password recovery, email verification, profile editing, and account deletion are not implemented in the current build.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-responsibilities">
        <h2 id="terms-responsibilities" className={headingClass}>4. User Responsibilities</h2>
        <p className={paragraphClass}>When submitting a report, provide a truthful description and select the actual issue location. Do not include passwords, unnecessary personal information, or confidential material in report text or evidence images. You are responsible for ensuring you are authorized to submit material you provide.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-acceptable">
        <h2 id="terms-acceptable" className={headingClass}>5. Acceptable Use</h2>
        <p className={paragraphClass}>Use the service for relevant municipal service issue reporting and authorized staff operations. Follow applicable laws and the terms of third-party map and location services. Do not access another user&apos;s account or restricted staff data.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-prohibited">
        <h2 id="terms-prohibited" className={headingClass}>6. Prohibited Activities</h2>
        <p className={paragraphClass}>Do not submit knowingly false, abusive, unlawful, threatening, unrelated, or confidential content; attempt to access another user&apos;s account or restricted staff data; interfere with the service; or misuse the map and location services. Additional operator rules, if any, must be supplied by [COMPANY NAME].</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-content">
        <h2 id="terms-content" className={headingClass}>7. User-Generated Content</h2>
        <p className={paragraphClass}>Reports and optional evidence are supplied by users. Public report views can show report details, location, and evidence without reporter identity; private staff notes and assignments are not part of public responses. Ownership and any permission needed to host, display, or process user-submitted material have not been established: [USER CONTENT RIGHTS / LICENSE TERMS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-property">
        <h2 id="terms-property" className={headingClass}>8. Intellectual Property</h2>
        <p className={paragraphClass}>The project does not identify the owner or licensing terms for its software, branding, or other materials. Confirm these details before publication: [INTELLECTUAL PROPERTY OWNER / LICENSE]. OpenStreetMap and other third-party materials remain subject to their own attribution and terms.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-availability">
        <h2 id="terms-availability" className={headingClass}>9. System Availability</h2>
        <p className={paragraphClass}>Availability, support hours, maintenance arrangements, and service levels are not specified. The repository states that the application is not live and is not ready for unrestricted public registration. Do not rely on it as the sole channel for urgent issues.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-third-party">
        <h2 id="terms-third-party" className={headingClass}>10. Third-Party Services</h2>
        <p className={paragraphClass}>Map tiles and place search use OpenStreetMap services; municipality boundary data is attributed to the Municipal Demarcation Board. Use of those services is subject to their own terms and policies. The application does not control their availability or data practices.</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-suspension">
        <h2 id="terms-suspension" className={headingClass}>11. Account Suspension or Termination</h2>
        <p className={paragraphClass}>Staff access can be managed through the super-admin tools. A general account suspension or termination policy, decision-maker, and notice or appeal process are not defined: [ACCOUNT SUSPENSION / TERMINATION PROCESS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-disclaimer">
        <h2 id="terms-disclaimer" className={headingClass}>12. Disclaimer</h2>
        <p className={paragraphClass}>The project does not establish warranties, guarantees of municipal action, or a service-level commitment. The appropriate disclaimer for a deployed service must be determined by its operator: [DISCLAIMER TERMS - LEGAL REVIEW REQUIRED].</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-liability">
        <h2 id="terms-liability" className={headingClass}>13. Limitation of Liability</h2>
        <p className={paragraphClass}>No liability allocation or limitation can be determined from the project. This section requires review and completion by the responsible operator: [LIABILITY TERMS - LEGAL REVIEW REQUIRED].</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-changes">
        <h2 id="terms-changes" className={headingClass}>14. Changes to the Terms</h2>
        <p className={paragraphClass}>The operator and process for publishing changes or notifying users have not been identified: [TERMS OWNER / CHANGE NOTICE PROCESS].</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-law">
        <h2 id="terms-law" className={headingClass}>15. Governing Law</h2>
        <p className={paragraphClass}>The applicable governing law and jurisdiction are not specified. Obtain appropriate review and complete this field before publication: [GOVERNING LAW / JURISDICTION].</p>
      </section>

      <section className={sectionClass} aria-labelledby="terms-contact">
        <h2 id="terms-contact" className={headingClass}>16. Contact Information</h2>
        <p className={paragraphClass}>For questions about these terms, contact [COMPANY NAME] at [SUPPORT EMAIL] or [PHYSICAL ADDRESS]. These details are placeholders, and no verified contact channel is configured. See the <Link href="/contact" className="font-medium text-emerald-700 underline underline-offset-2">Contact page</Link>.</p>
      </section>
    </InformationPage>
  );
}