#!/usr/bin/env python3
"""Genera k8s/07-kong-config.yaml a partir de kong-config/kong.yml.

kong-config/kong.yml es la unica fuente de verdad de la configuracion del gateway:
docker-compose la monta como volumen y Kubernetes la consume a traves del
ConfigMap que produce este script. Ejecutalo cada vez que edites kong-config/kong.yml:

    python k8s/sync-kong-config.py

Equivalente con kubectl (requiere cluster activo):

    kubectl -n parqueadero create configmap kong-declarative-config \
      --from-file=kong.yml=kong-config/kong.yml --dry-run=client -o yaml
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "kong-config" / "kong.yml"
TARGET = ROOT / "k8s" / "07-kong-config.yaml"

HEADER = """# =============================================================================
# ARCHIVO GENERADO - NO EDITAR A MANO
# Fuente: kong-config/kong.yml   |   Regenerar: python k8s/sync-kong-config.py
# =============================================================================
apiVersion: v1
kind: ConfigMap
metadata:
  name: kong-declarative-config
  namespace: parqueadero
data:
  kong.yml: |
"""


def main() -> None:
    body = SOURCE.read_text(encoding="utf-8")
    # Indenta 4 espacios para anidar bajo el bloque literal "kong.yml: |".
    indented = "".join(
        ("    " + line if line.strip() else "") + "\n"
        for line in body.splitlines()
    )
    TARGET.write_text(HEADER + indented, encoding="utf-8")
    print(f"OK  {SOURCE.relative_to(ROOT)} -> {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
