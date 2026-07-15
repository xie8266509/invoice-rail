"use client";

import { useMemo, useState } from "react";
import { CalendarBlank, CurrencyCircleDollar, IdentificationCard } from "@phosphor-icons/react";
import {
  Button,
  Callout,
  Heading,
  Select,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import type { Address } from "viem";
import { getArcBlockNumber } from "@/lib/arc";
import {
  createInvoice,
  validateInvoiceInput,
  type Invoice,
  type InvoiceInput,
  type InvoiceValidationErrors,
} from "@/lib/invoice";

type CreateInvoiceFormProps = {
  account?: Address;
  defaultRecipient?: Address;
  canCreate?: boolean;
  onCreated: (invoice: Invoice) => void | Promise<void>;
};

function defaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

const initialInput: InvoiceInput = {
  merchantName: "",
  recipient: "",
  amount: "",
  token: "USDC",
  memo: "",
  dueDate: defaultDueDate(),
};

export function CreateInvoiceForm({
  account,
  defaultRecipient,
  canCreate = true,
  onCreated,
}: CreateInvoiceFormProps) {
  const [input, setInput] = useState<InvoiceInput>(initialInput);
  const [errors, setErrors] = useState<InvoiceValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string>();

  const minDueDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const recipient = input.recipient || defaultRecipient || account || "";

  function update<K extends keyof InvoiceInput>(key: K, value: InvoiceInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setNotice(undefined);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) {
      setNotice("Viewer access is read-only.");
      return;
    }
    const completedInput = { ...input, recipient };
    const validation = validateInvoiceInput(completedInput);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setSubmitting(true);
    try {
      let blockNumber: bigint | undefined;
      try {
        blockNumber = await getArcBlockNumber();
      } catch {
        setNotice("Invoice created, but the RPC block anchor could not be recorded.");
      }
      const invoice = createInvoice(completedInput, blockNumber);
      await onCreated(invoice);
      setInput((current) => ({
        ...initialInput,
        merchantName: current.merchantName,
        recipient: current.recipient,
        dueDate: defaultDueDate(),
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The invoice could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="create-panel" aria-labelledby="create-heading">
      <div className="panel-heading">
        <Heading id="create-heading" size="6">
          Create an invoice
        </Heading>
        <Text size="2" color="gray">
          Generate a shareable request with an onchain reconciliation ID.
        </Text>
      </div>

      {notice ? (
        <Callout.Root color="amber" size="1" role="status">
          <Callout.Text>{notice}</Callout.Text>
        </Callout.Root>
      ) : null}

      <form onSubmit={submit} className="invoice-form" noValidate>
        <label className="field-group">
          <Text size="2" weight="medium">
            Merchant or project
          </Text>
          <TextField.Root
            value={input.merchantName}
            onChange={(event) => update("merchantName", event.target.value)}
            placeholder="Example: Northstar Studio"
            aria-invalid={Boolean(errors.merchantName)}
          >
            <TextField.Slot>
              <IdentificationCard size={17} />
            </TextField.Slot>
          </TextField.Root>
          {errors.merchantName ? <Text className="field-error">{errors.merchantName}</Text> : null}
        </label>

        <div className="form-row">
          <label className="field-group">
            <Text size="2" weight="medium">
              Amount
            </Text>
            <TextField.Root
              inputMode="decimal"
              value={input.amount}
              onChange={(event) => update("amount", event.target.value)}
              placeholder="0.00"
              aria-invalid={Boolean(errors.amount)}
            >
              <TextField.Slot>
                <CurrencyCircleDollar size={17} />
              </TextField.Slot>
            </TextField.Root>
            {errors.amount ? <Text className="field-error">{errors.amount}</Text> : null}
          </label>

          <label className="field-group">
            <Text size="2" weight="medium">
              Settlement asset
            </Text>
            <Select.Root
              value={input.token}
              onValueChange={(value) => update("token", value as InvoiceInput["token"])}
            >
              <Select.Trigger aria-label="Settlement asset" />
              <Select.Content>
                <Select.Item value="USDC">USDC</Select.Item>
                <Select.Item value="EURC">EURC</Select.Item>
              </Select.Content>
            </Select.Root>
          </label>
        </div>

        <label className="field-group">
          <div className="field-label-line">
            <Text size="2" weight="medium">
              Recipient address
            </Text>
            {account && recipient.toLowerCase() !== account.toLowerCase() ? (
              <button type="button" className="text-action" onClick={() => update("recipient", account)}>
                Use connected wallet
              </button>
            ) : null}
          </div>
          <TextField.Root
            value={recipient}
            onChange={(event) => update("recipient", event.target.value)}
            placeholder="0x..."
            className="mono-input"
            aria-invalid={Boolean(errors.recipient)}
          />
          {errors.recipient ? <Text className="field-error">{errors.recipient}</Text> : null}
        </label>

        <label className="field-group">
          <Text size="2" weight="medium">
            Invoice memo
          </Text>
          <TextArea
            value={input.memo}
            onChange={(event) => update("memo", event.target.value)}
            placeholder="Describe the product, service, or milestone"
            resize="vertical"
            rows={3}
            aria-invalid={Boolean(errors.memo)}
          />
          <div className="field-helper-line">
            {errors.memo ? <Text className="field-error">{errors.memo}</Text> : <span />}
            <Text size="1" color="gray">
              {input.memo.length}/120
            </Text>
          </div>
        </label>

        <label className="field-group">
          <Text size="2" weight="medium">
            Due date
          </Text>
          <TextField.Root
            type="date"
            min={minDueDate}
            value={input.dueDate}
            onChange={(event) => update("dueDate", event.target.value)}
            aria-invalid={Boolean(errors.dueDate)}
          >
            <TextField.Slot>
              <CalendarBlank size={17} />
            </TextField.Slot>
          </TextField.Root>
          {errors.dueDate ? <Text className="field-error">{errors.dueDate}</Text> : null}
        </label>

        <Button
          type="submit"
          size="3"
          disabled={submitting || !account || !canCreate}
          className="primary-submit"
        >
          {!account
            ? "Connect wallet to create"
            : !canCreate
              ? "Viewer access only"
            : submitting
              ? "Creating invoice..."
              : "Create invoice"}
        </Button>
      </form>
    </section>
  );
}
