---
name: Writing Feedback Tool
description: Existing light classroom workspace and notebook print system.
colors:
  primary: "#2563eb"
  primary-hover: "#1d4ed8"
  background: "#f1f5f9"
  panel: "#ffffff"
  text: "#1e293b"
  muted: "#526178"
  line: "#e2e8f0"
  success: "#047857"
  warning: "#92400e"
  error: "#b91c1c"
rounded:
  panel: "12px"
  dialog: "16px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
---

# Design System: Writing Feedback Tool

## Overview

This documents the incumbent interface, not a replacement visual direction. Preserve the light classroom workspace, blue actions, Inter typography, and separate two-page notebook print design. Teachers enter writing, review feedback, and save or preview it. Clear identity, readable feedback, and truthful persistence state take priority over decoration.

## Colors

Use the CSS custom properties in `index.html`. Primary blue identifies actions; dark slate carries text. Muted text must remain readable on its actual surface. Success, warning, and error have text labels as well as color. Enabled text needs measured contrast; disabled controls are a separate state.

## Typography

The interface uses Inter with platform sans-serif fallbacks. Essential help, session metadata, and overlay actions use at least 14px; form controls use 16px. Keep explanatory sentences in normal case. Existing short section and score labels may retain uppercase. Do not apply screen typography changes to the notebook's calibrated print styles.

## Layout

The desktop writing/report layout has two columns and a 24px gap. Input participates in normal page scrolling. Analyze stays near the writing, without a large fixed footer. At narrow widths, stack content, compress the header, preserve setup links, and let photo capture remain a disclosure. Hide report detail until current analysis exists. Test narrow screens and the 640px reflow equivalent of a 1280px viewport at 200% zoom.

## Elevation & Depth

White panels sit on the slate background. Keep existing restrained panel elevation. Modal backdrops and shadows distinguish protected interactions; they do not replace focus containment or background inertness.

## Shapes

Keep existing rounded panels and controls. Main panels use 12px corners; common dialogs use 16px. Text, not shape or color alone, identifies destructive actions.

## Components

Buttons use semantic colors and visible focus outlines. Native labeled inputs and checkboxes retain keyboard behavior; long checkbox labels form the whole touch target. Dialogs share one focus lifecycle, including native disclosures and nested previews. Busy controls retain descriptive text when motion is reduced.

Portfolios provide chronological chart values in a visible semantic table. Category controls use native checkboxes and line patterns as well as color. Session summaries show recent work compactly; original text and detailed feedback remain available on expansion.

Draft, local portfolio, and Drive states describe different stages. Show success only after the corresponding write succeeds. Recovery starts with preserving work and a backup; advanced cache/index tools remain under diagnostics.

## Do's and Don'ts

- Do preserve the existing scoring, student identity, and notebook design.
- Do test actual focus, contrast, failure, loading, empty, and long-content states.
- Do respect reduced motion while keeping busy and completion text.
- Don't infer a cloud save from a local write or a queued request.
- Don't use smaller metadata or uppercase prose to fit more content.
- Don't add a framework or a separate visual system for these repairs.
