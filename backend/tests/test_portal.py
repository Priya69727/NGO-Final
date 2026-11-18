from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.portal import _guard


@pytest.mark.parametrize("role", ["Member", "Volunteer"])
def test_portal_allows_volunteer_accounts(role):
    _guard(SimpleNamespace(role=role))


@pytest.mark.parametrize("role", ["Admin", "Project Manager", "Staff", "Board"])
def test_portal_rejects_main_system_accounts(role):
    with pytest.raises(HTTPException) as exc_info:
        _guard(SimpleNamespace(role=role))

    assert exc_info.value.status_code == 403
