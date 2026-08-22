import { Suspense, type FC } from "react";
import { LoginForm } from "../../src/features/auth/login-form";

const LoginPage: FC = () => {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
};

export default LoginPage;
