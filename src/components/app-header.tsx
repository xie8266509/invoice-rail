"use client";

import {
  ArrowSquareOut,
  Check,
  Desktop,
  Moon,
  Receipt,
  ShieldCheck,
  Sun,
  Wallet,
} from "@phosphor-icons/react";
import {
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Skeleton,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import type { Address } from "viem";
import { ARC_EXPLORER_URL } from "@/lib/constants";
import { formatAddress } from "@/lib/invoice";
import { useThemeMode } from "@/components/theme-shell";
import type { TokenBalances } from "@/lib/arc";
import type { MerchantSessionStatus } from "@/hooks/use-merchant-session";

type AppHeaderProps = {
  account?: Address;
  balances?: TokenBalances;
  connecting: boolean;
  loadingBalances: boolean;
  isArc: boolean;
  rpcOnline: boolean;
  balanceWarning?: string;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  authStatus?: MerchantSessionStatus;
  onSignIn?: () => void;
};

function displayBalance(value?: string): string {
  if (value === undefined) return "-";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function AppHeader({
  account,
  balances,
  connecting,
  loadingBalances,
  isArc,
  rpcOnline,
  balanceWarning,
  onConnect,
  onSwitchNetwork,
  authStatus,
  onSignIn,
}: AppHeaderProps) {
  const { mode, setMode } = useThemeMode();
  const ThemeIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Desktop;

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          <Receipt size={22} weight="duotone" />
        </span>
        <div>
          <Text as="div" size="3" weight="bold">
            Invoice Rail
          </Text>
          <Text as="div" size="1" color="gray">
            Independent Arc Testnet demo
          </Text>
        </div>
      </div>

      <Flex align="center" gap="3" className="header-actions">
        <a
          className="network-health"
          href={ARC_EXPLORER_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Open Arc Testnet explorer"
        >
          <span className={rpcOnline ? "health-dot is-online" : "health-dot"} />
          <Text size="1" weight="medium">
            {rpcOnline ? "Arc online" : "RPC unavailable"}
          </Text>
          <ArrowSquareOut size={13} />
        </a>

        <DropdownMenu.Root>
          <Tooltip content="Change color theme">
            <DropdownMenu.Trigger>
              <IconButton variant="soft" color="gray" aria-label="Change color theme">
                <ThemeIcon size={18} />
              </IconButton>
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Content align="end">
            {(
              [
                ["system", "System", Desktop],
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
              ] as const
            ).map(([value, label, Icon]) => (
              <DropdownMenu.Item key={value} onSelect={() => setMode(value)}>
                <Icon size={16} />
                {label}
                {mode === value ? <Check size={15} className="menu-check" /> : null}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        {account && !isArc ? (
          <Button variant="soft" color="amber" onClick={onSwitchNetwork}>
            Switch to Arc
          </Button>
        ) : null}

        {account && authStatus === "authenticated" ? (
          <Button variant="soft" color="jade" disabled>
            <ShieldCheck size={17} weight="duotone" />
            Signed in
          </Button>
        ) : account && authStatus ? (
          <Button
            variant="soft"
            color="gray"
            onClick={onSignIn}
            disabled={authStatus === "checking" || authStatus === "signing"}
          >
            <ShieldCheck size={17} />
            {authStatus === "signing"
              ? "Check wallet..."
              : authStatus === "checking"
                ? "Checking..."
                : "Sign in"}
          </Button>
        ) : null}

        {account ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button variant="outline" color="gray">
                <Wallet size={17} />
                {formatAddress(account)}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="wallet-menu">
              <Text size="1" color="gray" className="wallet-menu-label">
                Testnet balances
              </Text>
              <div className="balance-row">
                <Text size="2">USDC</Text>
                {loadingBalances ? (
                  <Skeleton width="64px" height="16px" />
                ) : (
                  <Text size="2" weight="bold">
                    {displayBalance(balances?.USDC)}
                  </Text>
                )}
              </div>
              <div className="balance-row">
                <Text size="2">EURC</Text>
                {loadingBalances ? (
                  <Skeleton width="64px" height="16px" />
                ) : (
                  <Text size="2" weight="bold">
                    {displayBalance(balances?.EURC)}
                  </Text>
                )}
              </div>
              {balanceWarning ? (
                <Text size="1" color="amber" className="wallet-menu-label">
                  {balanceWarning}
                </Text>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : (
          <Button onClick={onConnect} disabled={connecting}>
            <Wallet size={17} />
            {connecting ? "Connecting..." : "Connect wallet"}
          </Button>
        )}
      </Flex>
    </header>
  );
}
