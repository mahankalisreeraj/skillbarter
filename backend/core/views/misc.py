import requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.conf import settings

@api_view(['POST'])
@permission_classes([AllowAny])
def execute_code(request):
    """
    Proxy request to onlinecompiler.io API.
    Expects from frontend: { language: str, files: [{ content: str }] }
    """
    try:
        # 1. Extract data from the frontend format
        frontend_lang = request.data.get('language', 'javascript')
        files = request.data.get('files', [])
        
        if not files or not files[0].get('content'):
            return Response({'message': 'No code provided'}, status=400)
            
        code = files[0]['content']
        
        # 2. Map frontend language to onlinecompiler.io compiler string
        # See: https://onlinecompiler.io/docs#compilers
        COMPILER_MAP = {
            'python': 'python-3.14',
            'javascript': 'javascript-node-22', # Typical fallback if js is supported, though docs don't explicitly list JS, it's a common default. If not, this might fail. We'll try python for python.
            'js': 'javascript-node-22',
            'java': 'openjdk-25',
            'c': 'gcc-15',
            'cpp': 'g++-15',
            'c++': 'g++-15',
            'csharp': 'dotnet-csharp-9',
            'php': 'php-8.5',
            'ruby': 'ruby-4.0',
            'go': 'go-1.26',
            'rust': 'rust-1.93',
            'typescript': 'typescript-deno',
            'ts': 'typescript-deno'
        }
        
        compiler = COMPILER_MAP.get(frontend_lang.lower(), 'python-3.14') # Default to python if unknown

        api_key = getattr(settings, 'ONLINECOMPILER_API_KEY', '')
        if not api_key:
             return Response({'message': 'Server configuration error: Missing ONLINECOMPILER_API_KEY'}, status=500)

        # 3. Construct onlinecompiler payload
        payload = {
            "compiler": compiler,
            "code": code,
            "input": request.data.get('input', '')  # Optional standard input
        }

        # 4. Forward the request to onlinecompiler.io
        try:
            response = requests.post(
                'https://api.onlinecompiler.io/api/run-code-sync/',
                json=payload,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': api_key
                },
                timeout=15 # Online execution can take a few seconds
            )
        except requests.Timeout:
            return Response(
                {'message': 'Connection to onlinecompiler.io timed out.', 'error': 'Timeout connecting to execution engine'},
                status=504
            )
        
        # 5. Handle response and format back for frontend
        try:
            data = response.json()
        except ValueError:
            return Response({'message': 'Invalid response from execution engine', 'error': response.text}, status=502)

        if response.status_code == 200 and data.get('status') == 'success':
            # Format successful runs back to the { run: { stdout, stderr } } format Piston used
            formatted_data = {
                "run": {
                    "stdout": data.get('output', ''),
                    "stderr": data.get('error', '')
                }
            }
            return Response(formatted_data, status=200)
        else:
            # Handle API errors or compilation failures
            error_msg = data.get('error') or data.get('message') or 'Code execution failed'
            output_msg = data.get('output', '')
            
            # Even if it failed to compile, we want to show it in the stderr panel on frontend
            formatted_data = {
                 "run": {
                    "stdout": output_msg,
                    "stderr": error_msg
                }
            }
            return Response(formatted_data, status=response.status_code if response.status_code != 200 else 400)
            
    except Exception as e:
        print(f"ERROR: Unexpected error in execute_code: {e}")
        return Response(
            {'message': 'Internal Server Error during execution proxy', 'error': str(e)},
            status=500
        )
