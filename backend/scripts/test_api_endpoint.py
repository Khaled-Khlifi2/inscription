"""
Script pour tester l'endpoint de login étudiant directement.

Usage:
    python scripts/test_api_endpoint.py
"""
import urllib.request
import json

url = "http://localhost:3000/api/v1/auth/etudiant/login"

# Test 1: avec tous les champs
data1 = {
    "identifier": "15380750",
    "email": "khaledkhlifi577@gmail.com",
    "nom_fr": "ABDELLATIF",
    "prenom_fr": "YOUSSEF"
}

def test_post(url, data, description):
    print(f"{description}")
    print(f"URL: {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = response.read().decode('utf-8')
            print(f"Status: {status}")
            print(f"Response: {body}")
    except urllib.error.HTTPError as e:
        print(f"Status: {e.code}")
        print(f"Response: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error: {e}")
    print("\n" + "="*60 + "\n")

test_post(url, data1, "Test 1: Tous les champs")

# Test 2: sans nom/prenom (optionnels)
data2 = {
    "identifier": "15380750",
    "email": "khaledkhlifi577@gmail.com"
}

test_post(url, data2, "Test 2: Sans nom/prenom (optionnels)")
