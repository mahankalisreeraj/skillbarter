import requests

def test_piston():
    try:
        response = requests.post(
            'https://emkc.org/api/v2/piston/execute',
            json={
                "language": "python",
                "version": "*",
                "files": [{"content": "print('hello world')"}]
            },
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    test_piston()
