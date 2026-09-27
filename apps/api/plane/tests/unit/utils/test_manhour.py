# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.utils.manhour import manhour_from_estimate_value, normalize_manhour


@pytest.mark.unit
@pytest.mark.parametrize(
    ("value", "level", "expected"),
    [
        (None, 4, None),
        ("", 4, None),
        (2.5, 4, 2.5),
        ("3", 4, 3.0),
        (0, 4, 0.0),
    ],
)
def test_normalize_manhour_accepts_l4_values(value, level, expected):
    assert normalize_manhour(value, level) == expected


@pytest.mark.unit
def test_normalize_manhour_rejects_non_l4():
    with pytest.raises(ValueError, match="only valid for sub-tasks"):
        normalize_manhour(2, 3)


@pytest.mark.unit
def test_normalize_manhour_rejects_negative():
    with pytest.raises(ValueError, match="cannot be negative"):
        normalize_manhour(-1, 4)


@pytest.mark.unit
def test_normalize_manhour_rejects_non_numeric():
    with pytest.raises(ValueError, match="must be a number"):
        normalize_manhour("abc", 4)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, None),
        ("", None),
        ("abc", None),
        (0.5, 4.0),
        ("1", 8.0),
        (2, 16.0),
        (0, 0.0),
    ],
)
def test_manhour_from_estimate_value(value, expected):
    assert manhour_from_estimate_value(value) == expected
