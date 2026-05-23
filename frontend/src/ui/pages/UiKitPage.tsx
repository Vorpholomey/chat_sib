import { Search, Send } from "lucide-react";
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Heading,
  IconButton,
  Input,
  Label,
  Link,
  Modal,
  Muted,
  RoleBadge,
  Spinner,
  Text,
  Textarea,
} from "../components";
import { elementColors } from "../tokens/elementColors";
import type { ElementColorPart } from "../tokens/elementColors";

function Swatch({ part }: { part: ElementColorPart }) {
  const isText = part.classes.includes("text-") && !part.classes.includes("bg-");
  const bgClass = part.classes.split(/\s+/).find((c) => c.startsWith("bg-")) ?? "bg-surface-elevated";
  const textClass = part.classes.split(/\s+/).find((c) => c.startsWith("text-")) ?? "text-foreground";

  if (part.token === "dynamic" || part.token === "thirdParty") {
    return (
      <span className="text-xs text-foreground-muted italic" title={part.swatch}>
        {part.swatch}
      </span>
    );
  }

  if (isText && !part.classes.includes("bg-")) {
    return (
      <span className={cnInline(textClass, "text-sm font-medium")} title={part.swatch}>
        Aa
      </span>
    );
  }

  return (
    <span
      className={cnInline("inline-block h-6 w-10 rounded border border-border", bgClass)}
      title={part.swatch}
    />
  );
}

function cnInline(...parts: string[]) {
  return parts.filter(Boolean).join(" ");
}

function ColorMapTable() {
  const rows: {
    element: string;
    part: string;
    token: string;
    swatch: string;
    classes: string;
    partData: ElementColorPart;
  }[] = [];

  for (const [element, parts] of Object.entries(elementColors)) {
    for (const [part, data] of Object.entries(parts)) {
      rows.push({
        element,
        part,
        token: data.token,
        swatch: data.swatch,
        classes: data.classes,
        partData: data,
      });
    }
  }

  return (
    <section className="space-y-3">
      <HeadingLgSection title="Element → color map" />
      <p className="text-sm text-foreground-muted">
        Each UI element part maps to a semantic token and Tailwind classes. Dynamic colors (per-user
        usernames) and third-party widgets are documented but not tokenized.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/60">
              <th className="px-3 py-2 font-medium text-foreground-muted">Element</th>
              <th className="px-3 py-2 font-medium text-foreground-muted">Part</th>
              <th className="px-3 py-2 font-medium text-foreground-muted">Token</th>
              <th className="px-3 py-2 font-medium text-foreground-muted">Color</th>
              <th className="px-3 py-2 font-medium text-foreground-muted">Preview</th>
              <th className="px-3 py-2 font-medium text-foreground-muted">Classes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.element}-${row.part}`} className="border-b border-border/60">
                <td className="px-3 py-2 font-mono text-xs text-accent">{row.element}</td>
                <td className="px-3 py-2 text-foreground">{row.part}</td>
                <td className="px-3 py-2 font-mono text-xs text-link">{row.token}</td>
                <td className="px-3 py-2 text-xs text-foreground-muted">{row.swatch}</td>
                <td className="px-3 py-2">
                  <Swatch part={row.partData} />
                </td>
                <td className="max-w-xs px-3 py-2 font-mono text-[10px] text-foreground-muted break-all">
                  {row.classes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HeadingLgSection({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold text-foreground">{title}</h2>;
}

export function UiKitPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-6">
      <header>
        <Heading>UI kit</Heading>
        <Muted className="mt-1">
          Design tokens and primitives for the chat web app. Dev-only route.
        </Muted>
      </header>

      <ColorMapTable />

      <section className="space-y-4">
        <HeadingLgSection title="Buttons" />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <Button variant="primary" fullWidth>
          Full width primary
        </Button>
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Icon buttons" />
        <div className="flex gap-2">
          <IconButton size="sm" label="Search">
            <Search className="h-4 w-4" />
          </IconButton>
          <IconButton size="md" label="Send">
            <Send className="h-4 w-4" />
          </IconButton>
        </div>
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Form controls" />
        <Card className="max-w-sm space-y-3">
          <div>
            <Label htmlFor="ui-kit-email">Email</Label>
            <Input id="ui-kit-email" type="email" placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="ui-kit-note">Note</Label>
            <Textarea id="ui-kit-note" rows={2} placeholder="Optional message" />
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Card & modal" />
        <Card className="max-w-sm">
          <Text>Card surface with border tokens.</Text>
        </Card>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Open modal
        </Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          titleId="ui-kit-modal-title"
          title="Example modal"
        >
          <Muted>Modal overlay and panel use semantic surface tokens.</Muted>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setModalOpen(false)}>
              OK
            </Button>
          </div>
        </Modal>
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Links" />
        <p className="text-sm">
          <Link to="/login">Router link</Link>
          {" · "}
          <Link href="https://example.com" external>
            External link
          </Link>
        </p>
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Badges" />
        <div className="flex flex-wrap gap-2">
          <RoleBadge role="user" />
          <RoleBadge role="moderator" />
          <RoleBadge role="admin" />
          <Badge variant="warning">Pinned</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Alerts" />
        <Alert variant="warning">Editing message — changes are visible to everyone.</Alert>
        <Alert variant="info">Informational banner using muted surface tokens.</Alert>
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Dividers" />
        <Divider />
        <Divider variant="unread" label="New messages" />
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Spinner" />
        <Spinner />
      </section>

      <section className="space-y-4">
        <HeadingLgSection title="Chat patterns (reference)" />
        <div className="space-y-2">
          <div className="max-w-md rounded-lg border border-violet-800/35 bg-violet-950/35 px-3 py-2 text-sm text-foreground">
            Own message bubble
          </div>
          <div className="max-w-md rounded-lg border border-slate-700/80 bg-slate-800/75 px-3 py-2 text-sm text-slate-200">
            Other user bubble
          </div>
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
            Pinned message bar
          </div>
        </div>
      </section>
    </div>
  );
}
