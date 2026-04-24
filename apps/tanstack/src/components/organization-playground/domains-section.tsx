import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import {
	type OrganizationDomain,
	formatTimestamp,
	messageFromError,
} from "./shared";

export function DomainsSection({ organizationId }: { organizationId: string }) {
	const domainsQuery = useQuery({
		...convexQuery(api.zen.plugin.organization.listDomains, {
			organizationId,
		}),
	});
	const canCreateDomainQuery = useQuery({
		...convexQuery(api.zen.plugin.organization.hasPermission, {
			organizationId,
			permission: { resource: "domain", action: "create" },
		}),
	});
	const canVerifyDomainQuery = useQuery({
		...convexQuery(api.zen.plugin.organization.hasPermission, {
			organizationId,
			permission: { resource: "domain", action: "verify" },
		}),
	});

	const [domainHostname, setDomainHostname] = useState("");
	const domains: OrganizationDomain[] = domainsQuery.data ?? [];
	const addDomainMutation = useMutation({
		mutationFn: useConvexMutation(api.zen.plugin.organization.addDomain),
		onSuccess: () => {
			setDomainHostname("");
			void domainsQuery.refetch();
		},
	});
	const verifyDomainMutation = useMutation({
		mutationFn: useConvexMutation(
			api.zen.plugin.organization.markDomainVerified,
		),
		onSuccess: () => {
			void domainsQuery.refetch();
		},
	});

	return (
		<div className="card">
			<h2>Domains</h2>
			{domainsQuery.error ? (
				<p className="text-error">
					{messageFromError(domainsQuery.error, "Could not load domains")}
				</p>
			) : null}
			{addDomainMutation.error ? (
				<p className="text-error">
					{messageFromError(addDomainMutation.error, "Could not add domain")}
				</p>
			) : null}
			{verifyDomainMutation.error ? (
				<p className="text-error">
					{messageFromError(
						verifyDomainMutation.error,
						"Could not verify domain",
					)}
				</p>
			) : null}

			{canCreateDomainQuery.data ? (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						addDomainMutation.mutate({
							organizationId,
							hostname: domainHostname,
						});
					}}
				>
					<div className="field">
						<label htmlFor="domain-hostname">Hostname</label>
						<input
							id="domain-hostname"
							value={domainHostname}
							onChange={(event) => setDomainHostname(event.target.value)}
							placeholder="app.acme.com"
							required
						/>
					</div>
					<div className="actions">
						<button
							className="btn-primary"
							type="submit"
							disabled={addDomainMutation.isPending}
						>
							{addDomainMutation.isPending ? "Adding..." : "Add domain"}
						</button>
					</div>
				</form>
			) : (
				<p className="muted">You do not have permission to add domains.</p>
			)}
			<hr className="card-divider" />
			{domainsQuery.isError ? (
				<p className="muted">You do not have permission to view domains.</p>
			) : domains.length > 0 ? (
				domains.map((domain) => (
					<div key={domain._id} className="card">
						<strong>{domain.hostname}</strong>
						<p className="session-detail">
							Verified: {formatTimestamp(domain.verifiedAt)}
						</p>
						{canVerifyDomainQuery.data ? (
							<div className="actions">
								<button
									className="btn-secondary"
									type="button"
									disabled={verifyDomainMutation.isPending}
									onClick={() =>
										verifyDomainMutation.mutate({ domainId: domain._id })
									}
								>
									Mark verified
								</button>
							</div>
						) : null}
					</div>
				))
			) : (
				<p className="muted">No domains yet.</p>
			)}
		</div>
	);
}
