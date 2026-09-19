"""Minimal module exercising ``nixops-lib.python.check``."""


def hello(name: str) -> str:
    """Greet ``name``.

    >>> hello("World")
    'Hello, World!'
    """
    return f"Hello, {name}!"
