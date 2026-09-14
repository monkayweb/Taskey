"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey, shortDate } from "@/lib/date";
import { money } from "@/lib/rules";
import { SERVICES, serviceById, submissionDue } from "@/lib/services";
import { ROLE_LABEL } from "@/lib/labels";
import type { Lead } from "@/lib/types";
import { DatePicker } from "./DatePicker";
import { Chip, Field } from "./ui";

const firstName = (name: string) => name.split(" ")[0];

/**
 * Payment received. This is the only door a project comes through, so it asks
 * for the four things the sheet cannot work out for itself: what service, who
 * the client is, what they paid, and the day the money landed. Every date on
 * the workflow is then counted from that day.
 *
 * A lead that was won arrives here with everything sales already knows filled
 * in, and the sheet it opens closes the lead behind it.
 */
export function ProjectIntake({
  onDone,
  lead,
}: {
  onDone?: () => void;
  /** The won lead this payment is against, where there is one. */
  lead?: Lead;
}) {
  const now = useNow();
  const today = dayKey(now);
  const { users, intakeProject } = useTaskey();

  const consultants = users.filter(
    (u) => !u.archivedAt && u.workRole === "consultant",
  );
  const team = users.filter((u) => !u.archivedAt && u.role === "employee");
  const candidates = consultants.length > 0 ? consultants : team;

  const [serviceId, setServiceId] = useState(lead?.serviceId ?? SERVICES[0].id);
  const [client, setClient] = useState(lead?.company ?? "");
  const [contactName, setContactName] = useState(lead?.contactName ?? "");
  const [email, setEmail] = useState(lead?.contactEmail ?? "");
  const [phone, setPhone] = useState(lead?.contactPhone ?? "");
  const [fee, setFee] = useState<number | null>(
    lead?.value && lead.value > 0 ? lead.value : null,
  );
  const [amountPaid, setAmountPaid] = useState<number | null>(null);
  const [paidAt, setPaidAt] = useState(today);
  const [ownerId, setOwnerId] = useState(candidates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const service = serviceById(serviceId);
  // The catalogue price stands until somebody types over it.
  const effectiveFee = fee ?? service.fee;
  const paid = amountPaid ?? Math.round(effectiveFee * service.phases[0].share * 0.5);
  const due = submissionDue(service, paidAt);
  const owner = users.find((u) => u.id === ownerId);

  function submit() {
    if (!client.trim()) return setError("The client needs a name.");
    if (!contactName.trim())
      return setError("Somebody at the client has to be the contact.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("The documents get requested by email, so it has to be valid.");
    if (!ownerId) return setError("Pick the consultant who will carry it.");
    if (!(effectiveFee > 0)) return setError("The fee cannot be zero.");

    intakeProject({
      serviceId,
      client: client.trim(),
      clientContact: {
        name: contactName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
      },
      ownerId,
      fee: effectiveFee,
      amountPaid: Math.max(paid, 0),
      paidAt,
      leadId: lead?.id,
    });

    setConfirmed(
      `${client.trim()} opened. Submission due ${shortDate(due)}, and the request list is on the sheet.`,
    );
    setError(null);
    setClient("");
    setContactName("");
    setEmail("");
    setPhone("");
    setFee(null);
    setAmountPaid(null);
    onDone?.();
  }

  return (
    <section>
      <h2 className="text-[18px] font-bold tracking-tight">Payment received</h2>
      <p className="mt-1 text-[12px] leading-snug text-muted">
        {lead
          ? `From the ${lead.channel.replace("_", " ")} inquiry logged ${shortDate(lead.createdAt)}. Load the payment and the sheet builds itself, and the lead closes as won behind it.`
          : "Load the payment and the sheet builds itself: steps 5 to 10 of the workflow, their dates, the document request list and whoever each step belongs to."}
      </p>

      <div className="mt-6 space-y-4">
        <Field
          label="Service"
          hint={`${service.authority} · up to ${service.submissionDays} days to submit, then about ${service.processingDays} days processing${service.phases.length > 1 ? ` · ${service.phases.length} phases, quoted in equal amounts` : ""}`}
        >
          <div className="grid grid-cols-2 gap-2">
            {SERVICES.map((s) => (
              <Chip
                key={s.id}
                on={s.id === serviceId}
                onClick={() => {
                  setServiceId(s.id);
                  setFee(null);
                  setAmountPaid(null);
                }}
              >
                {s.short}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-line-strong/70 focus-within:ring-2 focus-within:ring-accent/40">
          <input
            id="intake-client"
            value={client}
            onChange={(e) => {
              setClient(e.target.value);
              setError(null);
            }}
            placeholder="Client, e.g. Kirstenhof Pharmacy"
            aria-label="Client"
            className="w-full bg-transparent px-3.5 py-2.5 text-[12px] font-semibold
                       text-ink outline-none placeholder:font-medium placeholder:text-faint"
          />
          <input
            value={contactName}
            onChange={(e) => {
              setContactName(e.target.value);
              setError(null);
            }}
            placeholder="Contact person"
            aria-label="Contact person"
            className="w-full border-t border-line bg-transparent px-3.5 py-2.5 text-[12px] text-ink outline-none placeholder:text-faint"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="Email for the document request"
            aria-label="Contact email"
            className="w-full border-t border-line bg-transparent px-3.5 py-2.5 text-[12px] text-ink outline-none placeholder:text-faint"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            aria-label="Contact phone"
            className="w-full border-t border-line bg-transparent px-3.5 py-2.5 text-[12px] text-ink outline-none placeholder:text-faint"
          />
        </div>

        <Field
          label="Payment received on"
          hint="The clock starts here, not on the day this is typed in."
        >
          <DatePicker
            value={paidAt}
            onChange={setPaidAt}
            label="Payment date"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fee (ZAR)">
            <input
              type="number"
              min={0}
              value={fee ?? service.fee}
              onChange={(e) => setFee(Number(e.target.value))}
              aria-label="Fee"
              className="field h-9 py-0 text-[13px] tabular-nums"
            />
          </Field>
          <Field label="Paid now (ZAR)">
            <input
              type="number"
              min={0}
              value={paid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              aria-label="Amount paid"
              className="field h-9 py-0 text-[13px] tabular-nums"
            />
          </Field>
        </div>

        <Field label="Consultant">
          <div className="grid grid-cols-3 gap-2">
            {candidates.map((u) => (
              <Chip key={u.id} on={u.id === ownerId} onClick={() => setOwnerId(u.id)}>
                {firstName(u.name)}
              </Chip>
            ))}
          </div>
        </Field>

        <p className="text-[11px] leading-snug text-muted" aria-live="polite">
          {confirmed ? (
            <span className="inline-flex items-start gap-1 font-medium text-ok">
              <Check size={12} className="mt-0.5 shrink-0" />
              {confirmed}
            </span>
          ) : (
            <>
              Submission to {service.authority} due{" "}
              <span className="font-medium text-ink">{shortDate(due)}</span>
              {service.phases.length > 1 && ` for ${service.phases[0].label}`}.{" "}
              {money(Math.max(Math.round(effectiveFee * service.phases[0].share) - paid, 0))}{" "}
              will be outstanding, falling due the day it is submitted. First
              step goes to {owner ? owner.name : "nobody yet"}
              {owner ? ` (${ROLE_LABEL[owner.workRole]})` : ""}.
            </>
          )}
        </p>

        {error && (
          <p role="alert" className="text-[12px] font-medium text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          className="btn btn-primary h-11 w-full rounded-lg text-[15px] font-semibold"
        >
          Open the project sheet
        </button>
      </div>
    </section>
  );
}
