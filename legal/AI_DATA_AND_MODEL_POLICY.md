# Clonify AI data and model policy

## One spatial product

Clonify uses one building workspace for Indoor Navigation, Indoor Showcase,
Indoor Renovation, and—when explicitly revealed by the administrator—Indoor
Robotics. A user’s captures are used to provide that user’s requested
workspace features by default.

## Optional model-improvement consent

Clonify does **not** use customer captures to improve models unless the user
opts in. Opt-in is stored with the account and can be withdrawn from Account.
Only de-identified, access-controlled training material should be exported for
model improvement. Withdrawal stops future use; it cannot retroactively remove
weights or datasets already created before withdrawal, so Clonify must retain
dataset lineage and deletion workflows.

## ONNX model lifecycle

ONNX is the deployment/interoperability format, not a general-purpose training
framework. Any training or fine-tuning must occur in an approved source
framework using consented data, with evaluation, audit logs, and human review.
The resulting computer-vision model may then be exported to ONNX and executed
locally with ONNX Runtime for privacy-preserving navigation and robotics
perception. No robotics model is exposed to customers until the confidential
robotics toggle and required IP/patent approval are complete.

This document is product guidance, not legal advice. Counsel should review
privacy notices, consent language, retention periods, cross-border processing,
biometric/privacy obligations, and patent strategy before production launch.
