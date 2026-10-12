"""
Security exception hierarchy for MCP-Sentinel.
Adheres to:
- Security Rule #9: Do not expose stack traces or secrets to users.
- Security Rule #10: Fail closed for security-sensitive failures.
"""


class SentinelError(Exception):
    """
    Base exception for all MCP-Sentinel domain errors.
    Provides a safe client-facing message and internal diagnostic details.
    """

    http_status_code: int = 400

    def __init__(self, safe_message: str, internal_details: str | None = None):
        super().__init__(safe_message)
        self.safe_message = safe_message
        self.internal_details = internal_details or safe_message

    def to_dict(self) -> dict:
        return {
            "status": "error",
            "error_type": self.__class__.__name__,
            "message": self.safe_message,
        }


class SecurityValidationError(SentinelError):
    """
    Raised when tool input validation fails or prohibited patterns are detected.
    """

    http_status_code: int = 422

    def __init__(self, message: str, internal_details: str | None = None):
        super().__init__(safe_message=message, internal_details=internal_details)


class AuthorizationDeniedError(SentinelError):
    """
    Raised when an operation lacks necessary approval or approval validation fails.
    Fails closed: always denies execution.
    """

    http_status_code: int = 403

    def __init__(
        self,
        message: str = "Destructive operation cannot be authorized.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class DatabaseOperationError(SentinelError):
    """
    Raised on database infrastructure or execution errors.
    Client message NEVER contains SQL text, table names, or connection strings.
    """

    http_status_code: int = 500

    def __init__(self, internal_details: str | None = None):
        super().__init__(
            safe_message="Unable to complete the requested database operation.",
            internal_details=internal_details or "Database execution error occurred.",
        )


class SecurityViolationError(SentinelError):
    """
    Raised when an active security violation (e.g. attempted SQL injection or replay) is detected.
    """

    http_status_code: int = 403

    def __init__(
        self,
        message: str = "Request rejected due to security policy violation.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class ConfigurationError(SentinelError):
    """
    Raised when required configuration or secrets (e.g. GEMINI_API_KEY) are missing or invalid.
    """

    http_status_code: int = 500

    def __init__(
        self,
        safe_message: str = "Application configuration error.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=safe_message, internal_details=internal_details)


class PolicyViolationError(SentinelError):
    """
    Raised when the Policy Engine denies a tool execution request.
    """

    http_status_code: int = 403

    def __init__(
        self,
        message: str = "Operation denied by server security policy.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class ApprovalRequiredError(SentinelError):
    """
    Raised when the Policy Engine requires human approval before proceeding.
    """

    http_status_code: int = 403

    def __init__(
        self,
        message: str = "Human approval is required before execution.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class NotFoundError(SentinelError):
    """
    Raised when a requested resource (tool, integration, policy, ticket) is not found.
    """

    http_status_code: int = 404

    def __init__(
        self,
        message: str = "Requested resource was not found.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class ConflictError(SentinelError):
    """
    Raised when a request conflicts with current resource state (e.g. concurrent mutation or replayed ticket).
    """

    http_status_code: int = 409

    def __init__(
        self,
        message: str = "Request conflicts with current resource state.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class RateLimitExceededError(SentinelError):
    """
    Raised when rate limits for an IP or user identity are exceeded.
    """

    http_status_code: int = 429

    def __init__(
        self,
        message: str = "Rate limit exceeded. Please retry after a cooldown period.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class ExecutionTimeoutError(SentinelError):
    """
    Raised when an agent reasoning or tool connector execution exceeds its bounded execution timeout.
    """

    http_status_code: int = 504

    def __init__(
        self,
        message: str = "Operation timed out. Execution was terminated to protect resources.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)


class UpstreamProviderError(SentinelError):
    """
    Raised when an upstream AI model provider (e.g. Gemini) or external MCP connector fails.
    """

    http_status_code: int = 502

    def __init__(
        self,
        message: str = "Upstream service provider encountered an error or is temporarily unavailable.",
        internal_details: str | None = None,
    ):
        super().__init__(safe_message=message, internal_details=internal_details)

