import { useState } from "react";
import type {
  OrganizationCapabilities,
  OrganizationDomain,
} from "./organizationPlaygroundShared";
import { formatTimestamp } from "./organizationPlaygroundShared";

export function DomainsCard(props: {
  capabilities: OrganizationCapabilities;
  domains: OrganizationDomain[];
  onAddDomain: (hostname: string) => Promise<void>;
  onMarkDomainVerified: (domainId: string) => Promise<void>;
}) {
  const [domainHostname, setDomainHostname] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await props.onAddDomain(domainHostname);
    setDomainHostname("");
  };

  return (
    <div className="card">
      <h2>Domains</h2>
      {props.capabilities.canCreateDomains ? (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="field">
            <label htmlFor="domain-hostname">Hostname</label>
            <input
              id="domain-hostname"
              value={domainHostname}
              onChange={(event) => setDomainHostname(event.target.value)}
              placeholder="portal.example.com"
              required
            />
          </div>
          <div className="actions">
            <button className="btn-primary" type="submit">
              Add domain
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">You do not have permission to add domains.</p>
      )}

      <hr className="card-divider" />

      {props.capabilities.canReadDomains ? (
        props.domains.length === 0 ? (
          <p className="muted">No domains configured.</p>
        ) : (
          props.domains.map((domain) => (
            <div key={domain._id} className="card">
              <strong>{domain.hostname}</strong>
              <p className="session-detail">
                Verified: {domain.verifiedAt ? formatTimestamp(domain.verifiedAt) : "no"}
              </p>
              {!domain.verifiedAt && props.capabilities.canVerifyDomains ? (
                <div className="actions">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => void props.onMarkDomainVerified(domain._id)}
                  >
                    Mark verified
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )
      ) : (
        <p className="muted">You do not have permission to view domains.</p>
      )}
    </div>
  );
}
