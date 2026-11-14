"""Build-time compatibility fixes for the LifeSync 0.1 source archive."""
from pathlib import Path
import re

path = Path("app/src/main/java/ru/petronotes/lifesync/HealthCollector.kt")
s = path.read_text(encoding="utf-8")
s = s.replace(
    "import androidx.health.connect.client.feature.ExperimentalFeatureAvailabilityApi\n",
    ""
)
s = s.replace("    @OptIn(ExperimentalFeatureAvailabilityApi::class)\n", "")
# Kotlin cannot put an index expression on a new line after a closing parenthesis.
s = re.sub(r"\)\n\s+(\[[A-Za-z][A-Za-z0-9_.]+\])", r")\1", s)
# Source declared Double.round(...) but invoked Double.rounded(...).
s = s.replace(".rounded(", ".round(")
path.write_text(s, encoding="utf-8")
print("Applied HealthConnect Kotlin compatibility fixes")
